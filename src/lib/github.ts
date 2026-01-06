import { createPrivateKey, createSign } from "node:crypto";
import { getSetting, setSetting } from "./auth";

const GITHUB_API = "https://api.github.com";

export interface GitHubAppCredentials {
  appId: string;
  slug: string;
  name: string;
  privateKey: string;
  webhookSecret: string;
  clientId: string;
  clientSecret: string;
  installationId: string | null;
}

export async function getGitHubAppCredentials(): Promise<GitHubAppCredentials | null> {
  const appId = await getSetting("github_app_id");
  if (!appId) return null;

  const slug = await getSetting("github_app_slug");
  const name = await getSetting("github_app_name");
  const privateKey = await getSetting("github_app_private_key");
  const webhookSecret = await getSetting("github_app_webhook_secret");
  const clientId = await getSetting("github_app_client_id");
  const clientSecret = await getSetting("github_app_client_secret");
  const installationId = await getSetting("github_app_installation_id");

  if (
    !slug ||
    !name ||
    !privateKey ||
    !webhookSecret ||
    !clientId ||
    !clientSecret
  ) {
    return null;
  }

  return {
    appId,
    slug,
    name,
    privateKey,
    webhookSecret,
    clientId,
    clientSecret,
    installationId,
  };
}

export async function hasGitHubApp(): Promise<boolean> {
  const creds = await getGitHubAppCredentials();
  return creds !== null && creds.installationId !== null;
}

export async function saveGitHubAppCredentials(creds: {
  appId: string;
  slug: string;
  name: string;
  privateKey: string;
  webhookSecret: string;
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  await setSetting("github_app_id", creds.appId);
  await setSetting("github_app_slug", creds.slug);
  await setSetting("github_app_name", creds.name);
  await setSetting("github_app_private_key", creds.privateKey);
  await setSetting("github_app_webhook_secret", creds.webhookSecret);
  await setSetting("github_app_client_id", creds.clientId);
  await setSetting("github_app_client_secret", creds.clientSecret);
}

export async function saveInstallationId(
  installationId: string,
): Promise<void> {
  await setSetting("github_app_installation_id", installationId);
}

export async function clearGitHubAppCredentials(): Promise<void> {
  const keys = [
    "github_app_id",
    "github_app_slug",
    "github_app_name",
    "github_app_private_key",
    "github_app_webhook_secret",
    "github_app_client_id",
    "github_app_client_secret",
    "github_app_installation_id",
  ];
  for (const key of keys) {
    await setSetting(key, "");
  }
}

function createJWT(appId: string, privateKeyPem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };

  const header = { alg: "RS256", typ: "JWT" };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const privateKey = createPrivateKey(privateKeyPem);
  const sign = createSign("RSA-SHA256");
  sign.update(`${headerB64}.${payloadB64}`);
  const signature = sign.sign(privateKey, "base64url");

  return `${headerB64}.${payloadB64}.${signature}`;
}

export async function generateInstallationToken(): Promise<string> {
  const creds = await getGitHubAppCredentials();
  if (!creds || !creds.installationId) {
    throw new Error("GitHub App not configured or not installed");
  }

  const jwt = createJWT(creds.appId, creds.privateKey);

  const res = await fetch(
    `${GITHUB_API}/app/installations/${creds.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to generate installation token: ${error}`);
  }

  const data = await res.json();
  return data.token;
}

export function isGitHubRepo(repoUrl: string): boolean {
  return repoUrl.includes("github.com");
}

export function injectTokenIntoUrl(repoUrl: string, token: string): string {
  if (repoUrl.startsWith("https://github.com/")) {
    return repoUrl.replace(
      "https://github.com/",
      `https://x-access-token:${token}@github.com/`,
    );
  }
  if (repoUrl.startsWith("git@github.com:")) {
    const path = repoUrl.replace("git@github.com:", "");
    return `https://x-access-token:${token}@github.com/${path}`;
  }
  return repoUrl;
}

export function buildManifest(domain: string): object {
  const baseUrl = `https://${domain}`;
  return {
    name: `Frost-${domain.split(".")[0]}`,
    url: baseUrl,
    hook_attributes: {
      url: `${baseUrl}/api/github/webhook`,
      active: true,
    },
    redirect_url: `${baseUrl}/api/github/callback`,
    callback_urls: [`${baseUrl}/api/github/callback`],
    setup_url: `${baseUrl}/api/github/install-callback`,
    public: false,
    default_permissions: {
      contents: "read",
      metadata: "read",
    },
    default_events: ["push"],
  };
}

export async function exchangeCodeForCredentials(code: string): Promise<{
  id: number;
  slug: string;
  name: string;
  pem: string;
  webhook_secret: string;
  client_id: string;
  client_secret: string;
}> {
  const res = await fetch(`${GITHUB_API}/app-manifests/${code}/conversions`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  return res.json();
}
