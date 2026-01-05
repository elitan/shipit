import { exec } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { nanoid } from "nanoid";
import { db } from "./db";
import {
  buildImage,
  getAvailablePort,
  runContainer,
  stopContainer,
  waitForHealthy,
} from "./docker";

const execAsync = promisify(exec);

const REPOS_PATH = join(process.cwd(), "repos");

if (!existsSync(REPOS_PATH)) {
  mkdirSync(REPOS_PATH, { recursive: true });
}

export type DeploymentStatus =
  | "pending"
  | "cloning"
  | "building"
  | "deploying"
  | "running"
  | "failed";

async function updateDeployment(
  id: string,
  updates: {
    status?: DeploymentStatus;
    build_log?: string;
    error_message?: string;
    container_id?: string;
    host_port?: number;
    finished_at?: number;
  },
) {
  await db
    .updateTable("deployments")
    .set(updates)
    .where("id", "=", id)
    .execute();
}

async function appendLog(id: string, log: string) {
  const deployment = await db
    .selectFrom("deployments")
    .select("build_log")
    .where("id", "=", id)
    .executeTakeFirst();

  const existingLog = deployment?.build_log || "";
  await updateDeployment(id, { build_log: existingLog + log });
}

export async function deploy(projectId: string): Promise<string> {
  const project = await db
    .selectFrom("projects")
    .selectAll()
    .where("id", "=", projectId)
    .executeTakeFirst();

  if (!project) {
    throw new Error("Project not found");
  }

  const deploymentId = nanoid();
  const now = Date.now();

  await db
    .insertInto("deployments")
    .values({
      id: deploymentId,
      project_id: projectId,
      commit_sha: "HEAD",
      status: "pending",
      created_at: now,
    })
    .execute();

  runDeployment(deploymentId, project).catch((err) => {
    console.error("Deployment failed:", err);
  });

  return deploymentId;
}

async function runDeployment(
  deploymentId: string,
  project: {
    id: string;
    name: string;
    repo_url: string;
    branch: string;
    dockerfile_path: string;
    port: number;
  },
) {
  const repoPath = join(REPOS_PATH, project.id);
  const containerName = `frost-${project.id}`.toLowerCase();

  try {
    await updateDeployment(deploymentId, { status: "cloning" });
    await appendLog(deploymentId, `Cloning ${project.repo_url}...\n`);

    if (existsSync(repoPath)) {
      rmSync(repoPath, { recursive: true, force: true });
    }

    const { stdout: cloneResult } = await execAsync(
      `git clone --depth 1 --branch ${project.branch} ${project.repo_url} ${repoPath}`,
    );
    await appendLog(deploymentId, cloneResult || "Cloned successfully\n");

    const { stdout: commitResult } = await execAsync(
      `git -C ${repoPath} rev-parse HEAD`,
    );
    const commitSha = commitResult.trim().substring(0, 7);

    await db
      .updateTable("deployments")
      .set({ commit_sha: commitSha })
      .where("id", "=", deploymentId)
      .execute();

    await updateDeployment(deploymentId, { status: "building" });
    await appendLog(deploymentId, `\nBuilding image...\n`);

    const imageName = `frost-${project.id}:${commitSha}`.toLowerCase();
    const buildResult = await buildImage(
      repoPath,
      imageName,
      project.dockerfile_path,
    );

    await appendLog(deploymentId, buildResult.log);

    if (!buildResult.success) {
      throw new Error(buildResult.error || "Build failed");
    }

    await updateDeployment(deploymentId, { status: "deploying" });
    await appendLog(deploymentId, `\nStarting container...\n`);

    const hostPort = await getAvailablePort();
    const runResult = await runContainer(
      imageName,
      hostPort,
      project.port,
      containerName,
    );

    if (!runResult.success) {
      throw new Error(runResult.error || "Failed to start container");
    }

    await appendLog(
      deploymentId,
      `Container started: ${runResult.containerId.substring(0, 12)}\n`,
    );
    await appendLog(deploymentId, `Waiting for container to be healthy...\n`);

    const isHealthy = await waitForHealthy(runResult.containerId);
    if (!isHealthy) {
      throw new Error("Container failed health check");
    }

    await updateDeployment(deploymentId, {
      status: "running",
      container_id: runResult.containerId,
      host_port: hostPort,
      finished_at: Date.now(),
    });

    await appendLog(
      deploymentId,
      `\nDeployment successful! App available at http://localhost:${hostPort}\n`,
    );

    const previousDeployments = await db
      .selectFrom("deployments")
      .select(["id", "container_id"])
      .where("project_id", "=", project.id)
      .where("id", "!=", deploymentId)
      .where("status", "=", "running")
      .execute();

    for (const prev of previousDeployments) {
      if (prev.container_id) {
        await stopContainer(prev.container_id);
      }
      await db
        .updateTable("deployments")
        .set({ status: "failed", finished_at: Date.now() })
        .where("id", "=", prev.id)
        .execute();
    }
  } catch (err: any) {
    const errorMessage = err.message || "Unknown error";
    await updateDeployment(deploymentId, {
      status: "failed",
      error_message: errorMessage,
      finished_at: Date.now(),
    });
    await appendLog(deploymentId, `\nError: ${errorMessage}\n`);
  }
}
