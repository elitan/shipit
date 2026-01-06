import { NextResponse } from "next/server";
import { getSetting } from "@/lib/auth";
import { getServerIp } from "@/lib/domains";

export async function GET() {
  const [domain, email, sslEnabled, serverIp] = await Promise.all([
    getSetting("domain"),
    getSetting("email"),
    getSetting("ssl_enabled"),
    getServerIp().catch(() => null),
  ]);

  return NextResponse.json({
    domain,
    email,
    ssl_enabled: sslEnabled,
    server_ip: serverIp,
  });
}
