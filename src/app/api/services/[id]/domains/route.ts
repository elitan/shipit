import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  addDomain,
  getDomainByName,
  getDomainsForService,
} from "@/lib/domains";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const service = await db
    .selectFrom("services")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst();

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const domains = await getDomainsForService(id);
  return NextResponse.json(domains);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const service = await db
    .selectFrom("services")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst();

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const { domain, type, redirectTarget, redirectCode } = body;

  if (!domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  const existing = await getDomainByName(domain);
  if (existing) {
    return NextResponse.json(
      { error: "Domain already exists" },
      { status: 400 },
    );
  }

  if (type === "redirect" && !redirectTarget) {
    return NextResponse.json(
      { error: "redirectTarget is required for redirect type" },
      { status: 400 },
    );
  }

  try {
    const newDomain = await addDomain(id, {
      domain,
      type,
      redirectTarget,
      redirectCode,
    });
    return NextResponse.json(newDomain, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add domain",
      },
      { status: 500 },
    );
  }
}
