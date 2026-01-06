import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stopContainer } from "@/lib/docker";
import { syncCaddyConfig } from "@/lib/domains";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const service = await db
    .selectFrom("services")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!service) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const latestDeployment = await db
    .selectFrom("deployments")
    .selectAll()
    .where("service_id", "=", id)
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();

  return NextResponse.json({ ...service, latestDeployment });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const service = await db
    .selectFrom("services")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!service) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    updates.name = body.name;
  }
  if (body.env_vars !== undefined) {
    updates.env_vars = JSON.stringify(body.env_vars);
  }
  if (body.container_port !== undefined) {
    if (body.container_port < 1 || body.container_port > 65535) {
      return NextResponse.json(
        { error: "container_port must be between 1 and 65535" },
        { status: 400 },
      );
    }
    updates.container_port = body.container_port;
  }
  if (service.deploy_type === "repo") {
    if (body.branch !== undefined) {
      updates.branch = body.branch;
    }
    if (body.dockerfile_path !== undefined) {
      updates.dockerfile_path = body.dockerfile_path;
    }
    if (body.repo_url !== undefined) {
      updates.repo_url = body.repo_url;
    }
  }
  if (service.deploy_type === "image") {
    if (body.image_url !== undefined) {
      updates.image_url = body.image_url;
    }
  }

  if (Object.keys(updates).length > 0) {
    await db
      .updateTable("services")
      .set(updates)
      .where("id", "=", id)
      .execute();
  }

  const updated = await db
    .selectFrom("services")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const deployments = await db
    .selectFrom("deployments")
    .select("container_id")
    .where("service_id", "=", id)
    .execute();

  for (const deployment of deployments) {
    if (deployment.container_id) {
      await stopContainer(deployment.container_id);
    }
  }

  await db.deleteFrom("services").where("id", "=", id).execute();

  try {
    await syncCaddyConfig();
  } catch {}

  return NextResponse.json({ success: true });
}
