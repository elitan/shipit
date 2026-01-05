import { exec } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { nanoid } from "nanoid";
import { db } from "./db";
import {
  buildImage,
  getAvailablePort,
  pullImage,
  runContainer,
  stopContainer,
  waitForHealthy,
} from "./docker";
import type { DeployType, EnvVar } from "./types";

const execAsync = promisify(exec);

const REPOS_PATH = join(process.cwd(), "repos");

if (!existsSync(REPOS_PATH)) {
  mkdirSync(REPOS_PATH, { recursive: true });
}

export type DeploymentStatus =
  | "pending"
  | "cloning"
  | "pulling"
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
    repo_url: string | null;
    branch: string | null;
    dockerfile_path: string | null;
    port: number;
    env_vars: string;
    image_url: string | null;
    deploy_type: DeployType;
  },
) {
  const containerName = `frost-${project.id}`.toLowerCase();

  const envVarsList: EnvVar[] = project.env_vars
    ? JSON.parse(project.env_vars)
    : [];
  const envVars: Record<string, string> = {};
  for (const e of envVarsList) {
    envVars[e.key] = e.value;
  }

  try {
    let imageName: string;

    if (project.deploy_type === "image") {
      if (!project.image_url) {
        throw new Error("Image URL is required for image deployments");
      }
      imageName = project.image_url;
      const imageTag = imageName.split(":")[1] || "latest";

      await updateDeployment(deploymentId, { status: "pulling" });
      await appendLog(deploymentId, `Pulling image ${imageName}...\n`);

      const pullResult = await pullImage(imageName);
      await appendLog(deploymentId, pullResult.log);

      if (!pullResult.success) {
        throw new Error(pullResult.error || "Pull failed");
      }

      await db
        .updateTable("deployments")
        .set({ commit_sha: imageTag })
        .where("id", "=", deploymentId)
        .execute();
    } else {
      if (!project.repo_url || !project.branch || !project.dockerfile_path) {
        throw new Error("Repo URL, branch, and Dockerfile path are required");
      }

      const repoPath = join(REPOS_PATH, project.id);

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

      if (envVarsList.length > 0) {
        const envFileContent = envVarsList
          .map((e) => `${e.key}=${e.value}`)
          .join("\n");
        writeFileSync(join(repoPath, ".env"), envFileContent);
        await appendLog(
          deploymentId,
          `Written ${envVarsList.length} env vars to .env\n`,
        );
      }

      await updateDeployment(deploymentId, { status: "building" });
      await appendLog(deploymentId, `\nBuilding image...\n`);

      imageName = `frost-${project.id}:${commitSha}`.toLowerCase();
      const buildResult = await buildImage(
        repoPath,
        imageName,
        project.dockerfile_path,
        envVars,
      );

      await appendLog(deploymentId, buildResult.log);

      if (!buildResult.success) {
        throw new Error(buildResult.error || "Build failed");
      }
    }

    await updateDeployment(deploymentId, { status: "deploying" });
    await appendLog(deploymentId, `\nStarting container...\n`);

    const hostPort = await getAvailablePort();
    const runResult = await runContainer(
      imageName,
      hostPort,
      project.port,
      containerName,
      envVars,
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
