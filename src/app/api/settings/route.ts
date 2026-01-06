import { NextResponse } from "next/server";
import { getSetting } from "@/lib/auth";

export async function GET() {
  const [domain, email, sslEnabled] = await Promise.all([
    getSetting("domain"),
    getSetting("email"),
    getSetting("ssl_enabled"),
  ]);

  return NextResponse.json({
    domain,
    email,
    ssl_enabled: sslEnabled,
  });
}
