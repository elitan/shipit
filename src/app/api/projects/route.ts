import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { getSetting } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const [projects, domain] = await Promise.all([
    db.selectFrom("projects").selectAll().execute(),
    getSetting("domain"),
  ]);

  const projectsWithDetails = await Promise.all(
    projects.map(async (project) => {
      const services = await db
        .selectFrom("services")
        .selectAll()
        .where("project_id", "=", project.id)
        .execute();

      const latestDeployment = await db
        .selectFrom("deployments")
        .innerJoin("services", "services.id", "deployments.service_id")
        .select([
          "deployments.status",
          "deployments.commit_message",
          "deployments.created_at",
          "services.branch",
        ])
        .where("deployments.project_id", "=", project.id)
        .orderBy("deployments.created_at", "desc")
        .executeTakeFirst();

      const runningDeployment = await db
        .selectFrom("deployments")
        .select(["host_port"])
        .where("project_id", "=", project.id)
        .where("status", "=", "running")
        .where("host_port", "is not", null)
        .executeTakeFirst();

      const firstService = services[0];
      const repoUrl = firstService?.repo_url ?? null;

      let runningUrl: string | null = null;
      if (runningDeployment?.host_port) {
        runningUrl = domain
          ? `${domain}:${runningDeployment.host_port}`
          : `localhost:${runningDeployment.host_port}`;
      }

      return {
        ...project,
        servicesCount: services.length,
        latestDeployment: latestDeployment
          ? {
              status: latestDeployment.status,
              commit_message: latestDeployment.commit_message,
              created_at: latestDeployment.created_at,
              branch: latestDeployment.branch,
            }
          : null,
        repoUrl,
        runningUrl,
      };
    }),
  );

  return NextResponse.json(projectsWithDetails);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, env_vars = [] } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const id = nanoid();
  const now = Date.now();

  await db
    .insertInto("projects")
    .values({
      id,
      name,
      env_vars: JSON.stringify(env_vars),
      created_at: now,
    })
    .execute();

  const project = await db
    .selectFrom("projects")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  return NextResponse.json(project, { status: 201 });
}
