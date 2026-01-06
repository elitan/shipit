import { NextResponse } from "next/server";
import {
  getDomain,
  syncCaddyConfig,
  updateDomain,
  verifyDomainDns,
} from "@/lib/domains";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const domain = await getDomain(id);

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  try {
    const dnsStatus = await verifyDomainDns(domain.domain);

    if (dnsStatus.valid && !domain.dns_verified) {
      await updateDomain(id, { dnsVerified: true });

      try {
        await syncCaddyConfig();
      } catch (err) {
        console.error("Failed to sync Caddy config:", err);
      }
    }

    return NextResponse.json({
      ...dnsStatus,
      dnsVerified: dnsStatus.valid,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "DNS verification failed",
      },
      { status: 500 },
    );
  }
}
