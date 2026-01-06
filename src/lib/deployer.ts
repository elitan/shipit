import { exec } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Selectable } from "kysely";
import { nanoid } from "nanoid";
import { db } from "./db";
import type { Project, Service } from "./db-types";
import {
  buildImage,
  createNetwork,
  getAvailablePort,
  pullImage,
  runContainer,
  stopContainer,
  waitForHealthy,
} from "./docker";
import { syncCaddyConfig } from "./domains";
import {
  generateInstallationToken,
  hasGitHubApp,
  injectTokenIntoUrl,
  isGitHubRepo,
} from "./github";
import type { EnvVar } from "./types";

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

function parseEnvVars(envVarsJson: string): Record<string, string> {
  const envVarsList: EnvVar[] = envVarsJson ? JSON.parse(envVarsJson) : [];
  const envVars: Record<string, string> = {};
  for (const e of envVarsList) {
    envVars[e.key] = e.value;
  }
  return envVars;
}

export async function deployProject(projectId: string): Promise<string[]> {
  const services = await db
    .selectFrom("services")
    .selectAll()
    .where("project_id", "=", projectId)
    .execute();

  if (services.length === 0) {
    throw new Error("No services to deploy");
  }

  const deploymentIds = await Promise.all(
    services.map((service) => deployService(service.id)),
  );

  return deploymentIds;
}

export async function deployService(serviceId: string): Promise<string> {
  const service = await db
    .selectFrom("services")
    .selectAll()
    .where("id", "=", serviceId)
    .executeTakeFirst();

  if (!service) {
    throw new Error("Service not found");
  }

  const project = await db
    .selectFrom("projects")
    .selectAll()
    .where("id", "=", service.project_id)
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
      project_id: project.id,
      service_id: serviceId,
      commit_sha: "HEAD",
      status: "pending",
      created_at: now,
    })
    .execute();

  runServiceDeployment(deploymentId, service, project).catch((err) => {
    console.error("Deployment failed:", err);
  });

  return deploymentId;
}

async function runServiceDeployment(
  deploymentId: string,
  service: Selectable<Service>,
  project: Selectable<Project>,
) {
  const containerName = `frost-${project.id}-${service.name}`.toLowerCase();
  const networkName = `frost-net-${project.id}`.toLowerCase();

  const projectEnvVars = parseEnvVars(project.env_vars);
  const serviceEnvVars = parseEnvVars(service.env_vars);
  const envVars = { ...projectEnvVars, ...serviceEnvVars };
  const envVarsList: EnvVar[] = Object.entries(envVars).map(([key, value]) => ({
    key,
    value,
  }));

  try {
    let imageName: string;

    if (service.deploy_type === "image") {
      if (!service.image_url) {
        throw new Error("Image URL is required for image deployments");
      }
      imageName = service.image_url;
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
      if (!service.repo_url || !service.branch || !service.dockerfile_path) {
        throw new Error("Repo URL, branch, and Dockerfile path are required");
      }

      const repoPath = join(REPOS_PATH, service.id);

      await updateDeployment(deploymentId, { status: "cloning" });
      await appendLog(deploymentId, `Cloning ${service.repo_url}...\n`);

      if (existsSync(repoPath)) {
        rmSync(repoPath, { recursive: true, force: true });
      }

      let cloneUrl = service.repo_url;
      if (isGitHubRepo(service.repo_url) && (await hasGitHubApp())) {
        try {
          const token = await generateInstallationToken();
          cloneUrl = injectTokenIntoUrl(service.repo_url, token);
          await appendLog(
            deploymentId,
            "Using GitHub App for authentication\n",
          );
        } catch (err: any) {
          await appendLog(
            deploymentId,
            `Warning: GitHub App auth failed (${err.message}), trying without auth\n`,
          );
        }
      }

      const { stdout: cloneResult } = await execAsync(
        `git clone --depth 1 --branch ${service.branch} ${cloneUrl} ${repoPath}`,
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

      imageName =
        `frost-${project.id}-${service.name}:${commitSha}`.toLowerCase();
      const buildResult = await buildImage(
        repoPath,
        imageName,
        service.dockerfile_path,
        envVars,
      );

      await appendLog(deploymentId, buildResult.log);

      if (!buildResult.success) {
        throw new Error(buildResult.error || "Build failed");
      }
    }

    await updateDeployment(deploymentId, { status: "deploying" });
    await appendLog(deploymentId, `\nStarting container...\n`);

    await createNetwork(networkName);

    const hostPort = await getAvailablePort();
    const runResult = await runContainer({
      imageName,
      hostPort,
      name: containerName,
      envVars,
      network: networkName,
      hostname: service.name,
    });

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

    try {
      await syncCaddyConfig();
      await appendLog(deploymentId, "Caddy config synced\n");
    } catch (err: any) {
      await appendLog(
        deploymentId,
        `Warning: Failed to sync Caddy config: ${err.message}\n`,
      );
    }

    const previousDeployments = await db
      .selectFrom("deployments")
      .select(["id", "container_id"])
      .where("service_id", "=", service.id)
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
