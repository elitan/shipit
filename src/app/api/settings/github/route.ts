import { NextResponse } from "next/server";
import { getSetting } from "@/lib/auth";
import { getGitHubAppCredentials } from "@/lib/github";

export async function GET() {
  const domain = await getSetting("domain");
  const sslEnabled = await getSetting("ssl_enabled");
  const creds = await getGitHubAppCredentials();

  const hasDomain = domain && sslEnabled === "true";

  return NextResponse.json({
    hasDomain,
    domain,
    connected: creds !== null,
    installed: creds?.installationId !== null,
    appName: creds?.name || null,
    appSlug: creds?.slug || null,
  });
}
