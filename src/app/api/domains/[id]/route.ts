import { NextResponse } from "next/server";
import {
  getDomain,
  removeDomain,
  syncCaddyConfig,
  updateDomain,
} from "@/lib/domains";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const domain = await getDomain(id);

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  return NextResponse.json(domain);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const domain = await getDomain(id);

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  const updates: Parameters<typeof updateDomain>[1] = {};

  if (body.type !== undefined) {
    updates.type = body.type;
  }
  if (body.redirectTarget !== undefined) {
    updates.redirectTarget = body.redirectTarget;
  }
  if (body.redirectCode !== undefined) {
    updates.redirectCode = body.redirectCode;
  }

  const updated = await updateDomain(id, updates);

  if (domain.dns_verified) {
    try {
      await syncCaddyConfig();
    } catch {}
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const domain = await getDomain(id);

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  await removeDomain(id);

  if (domain.dns_verified) {
    try {
      await syncCaddyConfig();
    } catch {}
  }

  return NextResponse.json({ success: true });
}
