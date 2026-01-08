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

  // Debug: log state before delete
  const servicesBefore = await db
    .selectFrom("services")
    .select(["id", "name"])
    .where("projectId", "=", id)
    .execute();
  console.log(
    `[DELETE project ${id}] Services before delete: ${JSON.stringify(servicesBefore)}`,
  );

  const domainsBefore = await db
    .selectFrom("domains")
    .innerJoin("services", "services.id", "domains.serviceId")
    .select(["domains.id", "domains.domain", "domains.serviceId"])
    .where("services.projectId", "=", id)
    .execute();
  console.log(
    `[DELETE project ${id}] Domains before delete: ${JSON.stringify(domainsBefore)}`,
  );

  const deployments = await db
    .selectFrom("deployments")
    .select(["id", "containerId", "status"])
    .where("projectId", "=", id)
    .execute();
  console.log(
    `[DELETE project ${id}] Deployments before delete: ${JSON.stringify(deployments.map((d) => ({ id: d.id, status: d.status })))}`,
  );

  for (const deployment of deployments) {
    if (deployment.containerId) {
      await stopContainer(deployment.containerId);
    }
  }

  await removeNetwork(`frost-net-${id}`.toLowerCase());

  await db.deleteFrom("projects").where("id", "=", id).execute();

  // Debug: verify cascade delete worked
  const domainsAfter = await db
    .selectFrom("domains")
    .select(["id", "domain"])
    .execute();
  console.log(
    `[DELETE project ${id}] All domains after delete: ${JSON.stringify(domainsAfter)}`,
  );

  const deploymentsAfter = await db
    .selectFrom("deployments")
    .select(["id", "status"])
    .execute();
  console.log(
    `[DELETE project ${id}] All deployments after delete: ${JSON.stringify(deploymentsAfter)}`,
  );

  return NextResponse.json({ success: true });
}
