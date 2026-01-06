import { NextResponse } from "next/server";
import { saveInstallationId } from "@/lib/github";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const installationId = url.searchParams.get("installation_id");

  if (!installationId) {
    return NextResponse.redirect(
      new URL("/settings/github?error=missing_installation_id", request.url),
    );
  }

  try {
    await saveInstallationId(installationId);
    return NextResponse.redirect(
      new URL("/settings/github?success=true", request.url),
    );
  } catch (err: any) {
    console.error("GitHub install callback error:", err);
    return NextResponse.redirect(
      new URL(
        `/settings/github?error=${encodeURIComponent(err.message)}`,
        request.url,
      ),
    );
  }
}
