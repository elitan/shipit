import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stopContainer } from "@/lib/docker";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const project = await db
    .selectFrom("projects")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const deployments = await db
    .selectFrom("deployments")
    .selectAll()
    .where("project_id", "=", id)
    .orderBy("created_at", "desc")
    .limit(10)
    .execute();

  return NextResponse.json({ ...project, deployments });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const project = await db
    .selectFrom("projects")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.env_vars !== undefined) {
    updates.env_vars = JSON.stringify(body.env_vars);
  }
  if (body.port !== undefined) {
    updates.port = body.port;
  }
  if (project.deploy_type === "repo") {
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
  if (project.deploy_type === "image") {
    if (body.image_url !== undefined) {
      updates.image_url = body.image_url;
    }
  }

  if (Object.keys(updates).length > 0) {
    await db
      .updateTable("projects")
      .set(updates)
      .where("id", "=", id)
      .execute();
  }

  const updated = await db
    .selectFrom("projects")
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
    .where("project_id", "=", id)
    .execute();

  for (const deployment of deployments) {
    if (deployment.container_id) {
      await stopContainer(deployment.container_id);
    }
  }

  await db.deleteFrom("projects").where("id", "=", id).execute();

  return NextResponse.json({ success: true });
}
