import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const services = await db
    .selectFrom("services")
    .selectAll()
    .where("project_id", "=", id)
    .execute();

  const servicesWithDeployments = await Promise.all(
    services.map(async (service) => {
      const latestDeployment = await db
        .selectFrom("deployments")
        .selectAll()
        .where("service_id", "=", service.id)
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst();

      return {
        ...service,
        latestDeployment,
      };
    }),
  );

  return NextResponse.json(servicesWithDeployments);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const body = await request.json();
  const {
    name,
    deploy_type = "repo",
    repo_url,
    branch = "main",
    dockerfile_path = "Dockerfile",
    image_url,
    env_vars = [],
    container_port,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (deploy_type === "repo" && !repo_url) {
    return NextResponse.json(
      { error: "repo_url is required for repo deployments" },
      { status: 400 },
    );
  }

  if (deploy_type === "image" && !image_url) {
    return NextResponse.json(
      { error: "image_url is required for image deployments" },
      { status: 400 },
    );
  }

  if (container_port !== undefined && (container_port < 1 || container_port > 65535)) {
    return NextResponse.json(
      { error: "container_port must be between 1 and 65535" },
      { status: 400 },
    );
  }

  const project = await db
    .selectFrom("projects")
    .select("id")
    .where("id", "=", projectId)
    .executeTakeFirst();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const existing = await db
    .selectFrom("services")
    .select("id")
    .where("project_id", "=", projectId)
    .where("name", "=", name)
    .executeTakeFirst();

  if (existing) {
    return NextResponse.json(
      { error: "Service with this name already exists in project" },
      { status: 400 },
    );
  }

  const id = nanoid();
  const now = Date.now();

  await db
    .insertInto("services")
    .values({
      id,
      project_id: projectId,
      name,
      deploy_type,
      repo_url: deploy_type === "repo" ? repo_url : null,
      branch: deploy_type === "repo" ? branch : null,
      dockerfile_path: deploy_type === "repo" ? dockerfile_path : null,
      image_url: deploy_type === "image" ? image_url : null,
      env_vars: JSON.stringify(env_vars),
      container_port: container_port ?? null,
      created_at: now,
    })
    .execute();

  const service = await db
    .selectFrom("services")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  return NextResponse.json(service, { status: 201 });
}
