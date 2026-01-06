import { NextResponse } from "next/server";
import { getSetting } from "@/lib/auth";
import { saveInstallationId } from "@/lib/github";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const installationId = url.searchParams.get("installation_id");
  const domain = await getSetting("domain");
  const baseUrl = domain ? `https://${domain}` : url.origin;

  if (!installationId) {
    return NextResponse.redirect(
      new URL("/settings/github?error=missing_installation_id", baseUrl),
    );
  }

  try {
    await saveInstallationId(installationId);
    return NextResponse.redirect(new URL("/settings/github?success=true", baseUrl));
  } catch (err: any) {
    console.error("GitHub install callback error:", err);
    return NextResponse.redirect(
      new URL(
        `/settings/github?error=${encodeURIComponent(err.message)}`,
        baseUrl,
      ),
    );
  }
}
