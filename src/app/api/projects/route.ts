import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const projects = await db.selectFrom("projects").selectAll().execute();

  const projectsWithStatus = await Promise.all(
    projects.map(async (project) => {
      const latestDeployment = await db
        .selectFrom("deployments")
        .select("status")
        .where("project_id", "=", project.id)
        .orderBy("created_at", "desc")
        .limit(1)
        .executeTakeFirst();

      return {
        ...project,
        latestStatus: latestDeployment?.status,
      };
    }),
  );

  return NextResponse.json(projectsWithStatus);
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    name,
    deploy_type = "repo",
    repo_url,
    branch = "main",
    dockerfile_path = "Dockerfile",
    image_url,
    port = 3000,
    env_vars = [],
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

  const id = nanoid();
  const now = Date.now();

  await db
    .insertInto("projects")
    .values({
      id,
      name,
      deploy_type,
      repo_url: deploy_type === "repo" ? repo_url : null,
      branch: deploy_type === "repo" ? branch : null,
      dockerfile_path: deploy_type === "repo" ? dockerfile_path : null,
      image_url: deploy_type === "image" ? image_url : null,
      port,
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
