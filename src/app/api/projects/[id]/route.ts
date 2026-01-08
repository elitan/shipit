import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { removeNetwork, stopContainer } from "@/lib/docker";
import { updateSystemDomain } from "@/lib/domains";

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

  const services = await db
    .selectFrom("services")
    .selectAll()
    .where("projectId", "=", id)
    .execute();

  const servicesWithDeployments = await Promise.all(
    services.map(async (service) => {
      const latestDeployment = await db
        .selectFrom("deployments")
        .selectAll()
        .where("serviceId", "=", service.id)
        .orderBy("createdAt", "desc")
        .limit(1)
        .executeTakeFirst();

      return {
        ...service,
        latestDeployment,
      };
    }),
  );

  return NextResponse.json({ ...project, services: servicesWithDeployments });
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
  if (body.name !== undefined) {
    updates.name = body.name;
  }
  if (body.envVars !== undefined) {
    updates.envVars = JSON.stringify(body.envVars);
  }

  if (Object.keys(updates).length > 0) {
    await db
      .updateTable("projects")
      .set(updates)
      .where("id", "=", id)
      .execute();
  }

  if (body.name !== undefined && body.name !== project.name) {
    const services = await db
      .selectFrom("services")
      .select(["id", "name"])
      .where("projectId", "=", id)
      .execute();
    for (const svc of services) {
      await updateSystemDomain(svc.id, svc.name, body.name);
    }
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
    .select(["id", "containerId"])
    .where("projectId", "=", id)
    .execute();

  for (const deployment of deployments) {
    if (deployment.containerId) {
      await stopContainer(deployment.containerId);
    }
  }

  await removeNetwork(`frost-net-${id}`.toLowerCase());

  await db.deleteFrom("projects").where("id", "=", id).execute();

  return NextResponse.json({ success: true });
}
