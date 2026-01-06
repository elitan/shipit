const CADDY_ADMIN = "http://localhost:2019";

export async function isCaddyRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${CADDY_ADMIN}/config/`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getCurrentConfig(): Promise<unknown> {
  const res = await fetch(`${CADDY_ADMIN}/config/`);
  if (!res.ok) throw new Error("Failed to get Caddy config");
  return res.json();
}

export async function configureDomain(
  domain: string,
  email: string,
): Promise<void> {
  const config = {
    apps: {
      http: {
        servers: {
          https: {
            listen: [":443"],
            routes: [
              {
                match: [{ host: [domain] }],
                handle: [
                  {
                    handler: "reverse_proxy",
                    upstreams: [{ dial: "localhost:3000" }],
                  },
                ],
              },
            ],
          },
          http: {
            listen: [":80"],
            routes: [
              {
                match: [{ host: [domain] }],
                handle: [
                  {
                    handler: "static_response",
                    status_code: 301,
                    headers: {
                      Location: ["https://{http.request.host}{http.request.uri}"],
                    },
                  },
                ],
              },
              {
                handle: [
                  {
                    handler: "reverse_proxy",
                    upstreams: [{ dial: "localhost:3000" }],
                  },
                ],
              },
            ],
          },
        },
      },
      tls: {
        automation: {
          policies: [
            {
              subjects: [domain],
              issuers: [{ module: "acme", email }],
            },
          ],
        },
      },
    },
  };

  const res = await fetch(`${CADDY_ADMIN}/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to configure Caddy: ${text}`);
  }
}

export async function lockToDomain(domain: string): Promise<void> {
  const config = {
    apps: {
      http: {
        servers: {
          https: {
            listen: [":443"],
            routes: [
              {
                match: [{ host: [domain] }],
                handle: [
                  {
                    handler: "reverse_proxy",
                    upstreams: [{ dial: "localhost:3000" }],
                  },
                ],
              },
            ],
          },
          http: {
            listen: [":80"],
            routes: [
              {
                match: [{ host: [domain] }],
                handle: [
                  {
                    handler: "static_response",
                    status_code: 301,
                    headers: {
                      Location: ["https://{http.request.host}{http.request.uri}"],
                    },
                  },
                ],
              },
              {
                handle: [
                  {
                    handler: "static_response",
                    status_code: 301,
                    headers: {
                      Location: [`https://${domain}{http.request.uri}`],
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    },
  };

  const res = await fetch(`${CADDY_ADMIN}/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to lock to domain: ${text}`);
  }
}

export async function removeDomainConfig(): Promise<void> {
  const config = {
    apps: {
      http: {
        servers: {
          srv0: {
            listen: [":80"],
            routes: [
              {
                handle: [
                  {
                    handler: "static_response",
                    body: "Frost - Configure domain in settings",
                  },
                ],
              },
            ],
          },
        },
      },
    },
  };

  const res = await fetch(`${CADDY_ADMIN}/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to reset Caddy config: ${text}`);
  }
}
