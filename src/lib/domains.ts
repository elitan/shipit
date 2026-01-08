import { promises as dns } from "node:dns";
import { nanoid } from "nanoid";
import { getSetting } from "./auth";
import { db } from "./db";

const CADDY_ADMIN = "http://localhost:2019";
const ACME_STAGING_CA =
  "https://acme-staging-v02.api.letsencrypt.org/directory";

export interface DomainInput {
  domain: string;
  type?: "proxy" | "redirect";
  redirectTarget?: string;
  redirectCode?: 301 | 307;
}

export interface DnsStatus {
  valid: boolean;
  serverIp: string;
  domainIp: string | null;
}

export async function addDomain(serviceId: string, input: DomainInput) {
  const { domain, type = "proxy", redirectTarget, redirectCode = 301 } = input;

  const id = nanoid();
  const now = Date.now();

  await db
    .insertInto("domains")
    .values({
      id,
      service_id: serviceId,
      domain: domain.toLowerCase(),
      type,
      redirect_target: type === "redirect" ? redirectTarget : null,
      redirect_code: type === "redirect" ? redirectCode : null,
      dns_verified: 0,
      ssl_status: "pending",
      created_at: now,
    })
    .execute();

  return getDomain(id);
}

export async function getDomain(id: string) {
  return db
    .selectFrom("domains")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function getDomainByName(domain: string) {
  return db
    .selectFrom("domains")
    .selectAll()
    .where("domain", "=", domain.toLowerCase())
    .executeTakeFirst();
}

export async function getDomainsForService(serviceId: string) {
  return db
    .selectFrom("domains")
    .selectAll()
    .where("service_id", "=", serviceId)
    .orderBy("created_at", "desc")
    .execute();
}

export async function updateDomain(
  id: string,
  updates: Partial<{
    type: "proxy" | "redirect";
    redirectTarget: string | null;
    redirectCode: 301 | 307;
    dnsVerified: boolean;
    sslStatus: "pending" | "active" | "failed";
  }>,
) {
  const setValues: Record<string, unknown> = {};

  if (updates.type !== undefined) setValues.type = updates.type;
  if (updates.redirectTarget !== undefined)
    setValues.redirect_target = updates.redirectTarget;
  if (updates.redirectCode !== undefined)
    setValues.redirect_code = updates.redirectCode;
  if (updates.dnsVerified !== undefined)
    setValues.dns_verified = updates.dnsVerified ? 1 : 0;
  if (updates.sslStatus !== undefined) setValues.ssl_status = updates.sslStatus;

  if (Object.keys(setValues).length === 0) return getDomain(id);

  await db.updateTable("domains").set(setValues).where("id", "=", id).execute();

  return getDomain(id);
}

export async function removeDomain(id: string) {
  await db.deleteFrom("domains").where("id", "=", id).execute();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function buildSslipDomain(
  serviceName: string,
  projectName: string,
  serverIp: string,
  suffix?: number,
): string {
  const serviceSlug = slugify(serviceName);
  const projectSlug = slugify(projectName);
  const base = `${serviceSlug}-${projectSlug}`;
  const withSuffix = suffix ? `${base}-${suffix}` : base;
  return `${withSuffix}.${serverIp}.sslip.io`;
}

export async function getSystemDomainForService(serviceId: string) {
  const domain = await db
    .selectFrom("domains")
    .selectAll()
    .where("service_id", "=", serviceId)
    .where("is_system", "=", 1)
    .executeTakeFirst();
  return domain ?? null;
}

export async function createSystemDomain(
  serviceId: string,
  serviceName: string,
  projectName: string,
): Promise<void> {
  if (process.env.NODE_ENV === "development") return;

  let serverIp: string;
  try {
    serverIp = await getServerIp();
  } catch {
    return;
  }

  let domain: string | null = null;
  for (let i = 0; i < 10; i++) {
    const candidate = buildSslipDomain(
      serviceName,
      projectName,
      serverIp,
      i === 0 ? undefined : i + 1,
    );
    const existing = await getDomainByName(candidate);
    if (!existing) {
      domain = candidate;
      break;
    }
  }

  if (!domain) {
    console.error("Could not generate unique sslip.io domain after 10 attempts");
    return;
  }

  const id = nanoid();
  const now = Date.now();

  await db
    .insertInto("domains")
    .values({
      id,
      service_id: serviceId,
      domain,
      type: "proxy",
      redirect_target: null,
      redirect_code: null,
      dns_verified: 1,
      ssl_status: "pending",
      created_at: now,
      is_system: 1,
    })
    .execute();

  await syncCaddyConfig();
}

export async function updateSystemDomain(
  serviceId: string,
  newServiceName: string,
  newProjectName: string,
): Promise<void> {
  if (process.env.NODE_ENV === "development") return;

  const existing = await getSystemDomainForService(serviceId);
  if (!existing) return;

  let serverIp: string;
  try {
    serverIp = await getServerIp();
  } catch {
    return;
  }

  let domain: string | null = null;
  for (let i = 0; i < 10; i++) {
    const candidate = buildSslipDomain(
      newServiceName,
      newProjectName,
      serverIp,
      i === 0 ? undefined : i + 1,
    );
    const existingDomain = await getDomainByName(candidate);
    if (!existingDomain || existingDomain.id === existing.id) {
      domain = candidate;
      break;
    }
  }

  if (!domain) {
    console.error("Could not generate unique sslip.io domain after 10 attempts");
    return;
  }

  await db
    .updateTable("domains")
    .set({ domain })
    .where("id", "=", existing.id)
    .execute();

  await syncCaddyConfig();
}

export async function getServerIp(): Promise<string> {
  const services = ["https://api.ipify.org", "https://ifconfig.me/ip"];

  for (const url of services) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const ip = await res.text();
        return ip.trim();
      }
    } catch {}
  }

  throw new Error("Could not determine server IP");
}

async function resolveDomain(domain: string): Promise<string[]> {
  try {
    return await dns.resolve4(domain);
  } catch {
    return [];
  }
}

export async function verifyDomainDns(domain: string): Promise<DnsStatus> {
  const [serverIp, domainIps] = await Promise.all([
    getServerIp(),
    resolveDomain(domain),
  ]);

  return {
    valid: domainIps.includes(serverIp),
    serverIp,
    domainIp: domainIps[0] || null,
  };
}

function acmeIssuer(email: string, staging: boolean) {
  return staging
    ? { module: "acme", email, ca: ACME_STAGING_CA }
    : { module: "acme", email };
}

interface DomainRoute {
  domain: string;
  type: "proxy" | "redirect" | "frost-admin";
  hostPort?: number;
  redirectTarget?: string;
  redirectCode?: number;
}

function buildCaddyConfig(
  routes: DomainRoute[],
  email: string,
  staging: boolean,
) {
  const httpsRoutes: unknown[] = [];
  const allDomains: string[] = [];

  for (const route of routes) {
    allDomains.push(route.domain);

    if (route.type === "frost-admin" || route.type === "proxy") {
      const dial =
        route.type === "frost-admin"
          ? "localhost:3000"
          : `localhost:${route.hostPort}`;

      httpsRoutes.push({
        match: [{ host: [route.domain] }],
        handle: [
          {
            handler: "reverse_proxy",
            upstreams: [{ dial }],
          },
        ],
      });
    } else if (route.type === "redirect") {
      httpsRoutes.push({
        match: [{ host: [route.domain] }],
        handle: [
          {
            handler: "static_response",
            status_code: route.redirectCode || 301,
            headers: {
              Location: [`https://${route.redirectTarget}{http.request.uri}`],
            },
          },
        ],
      });
    }
  }

  return {
    apps: {
      http: {
        servers: {
          https: {
            listen: [":443"],
            routes: httpsRoutes,
          },
          http: {
            listen: [":80"],
            routes: [
              {
                handle: [
                  {
                    handler: "static_response",
                    status_code: 301,
                    headers: {
                      Location: [
                        "https://{http.request.host}{http.request.uri}",
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      },
      tls:
        allDomains.length > 0
          ? {
              automation: {
                policies: [
                  {
                    subjects: allDomains,
                    issuers: [acmeIssuer(email, staging)],
                  },
                ],
              },
            }
          : undefined,
    },
  };
}

export async function syncCaddyConfig() {
  const frostDomain = await getSetting("domain");
  const email = await getSetting("email");
  const staging = (await getSetting("ssl_staging")) === "true";

  if (!email) {
    console.log("No email configured, skipping Caddy sync");
    return;
  }

  const verifiedDomains = await db
    .selectFrom("domains")
    .innerJoin("services", "services.id", "domains.service_id")
    .innerJoin("deployments", (join) =>
      join
        .onRef("deployments.service_id", "=", "services.id")
        .on("deployments.status", "=", "running"),
    )
    .select([
      "domains.domain",
      "domains.type",
      "domains.redirect_target",
      "domains.redirect_code",
      "deployments.host_port",
    ])
    .where("domains.dns_verified", "=", 1)
    .execute();

  const routes: DomainRoute[] = [];

  if (frostDomain) {
    routes.push({
      domain: frostDomain,
      type: "frost-admin",
    });
  }

  for (const d of verifiedDomains) {
    if (d.type === "proxy" && d.host_port) {
      routes.push({
        domain: d.domain,
        type: "proxy",
        hostPort: d.host_port,
      });
    } else if (d.type === "redirect" && d.redirect_target) {
      routes.push({
        domain: d.domain,
        type: "redirect",
        redirectTarget: d.redirect_target,
        redirectCode: d.redirect_code || 301,
      });
    }
  }

  if (routes.length === 0) {
    console.log("No domains to configure");
    return;
  }

  const config = buildCaddyConfig(routes, email, staging);

  const res = await fetch(`${CADDY_ADMIN}/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to sync Caddy config: ${text}`);
  }

  console.log(`Caddy config synced with ${routes.length} domain(s)`);
}
