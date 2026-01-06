import { exec, spawn } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface BuildResult {
  success: boolean;
  imageName: string;
  log: string;
  error?: string;
}

export interface RunResult {
  success: boolean;
  containerId: string;
  error?: string;
}

export async function buildImage(
  repoPath: string,
  imageName: string,
  dockerfilePath: string = "Dockerfile",
  envVars?: Record<string, string>,
): Promise<BuildResult> {
  return new Promise((resolve) => {
    let log = "";
    const buildContext = join(repoPath, dirname(dockerfilePath));
    const args = ["build", "-t", imageName, "-f", basename(dockerfilePath)];
    if (envVars) {
      for (const [key, value] of Object.entries(envVars)) {
        args.push("--build-arg", `${key}=${value}`);
      }
    }
    args.push(".");
    const proc = spawn("docker", args, {
      cwd: buildContext,
    });

    proc.stdout.on("data", (data) => {
      log += data.toString();
    });

    proc.stderr.on("data", (data) => {
      log += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, imageName, log });
      } else {
        resolve({
          success: false,
          imageName,
          log,
          error: `Build exited with code ${code}`,
        });
      }
    });

    proc.on("error", (err) => {
      resolve({ success: false, imageName, log, error: err.message });
    });
  });
}

export async function pullImage(imageName: string): Promise<BuildResult> {
  return new Promise((resolve) => {
    let log = "";
    const proc = spawn("docker", ["pull", imageName]);

    proc.stdout.on("data", (data) => {
      log += data.toString();
    });

    proc.stderr.on("data", (data) => {
      log += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, imageName, log });
      } else {
        resolve({
          success: false,
          imageName,
          log,
          error: `Pull exited with code ${code}`,
        });
      }
    });

    proc.on("error", (err) => {
      resolve({ success: false, imageName, log, error: err.message });
    });
  });
}

const DEFAULT_PORT = 8080;

export interface RunContainerOptions {
  imageName: string;
  hostPort: number;
  containerPort?: number;
  name: string;
  envVars?: Record<string, string>;
  network?: string;
  hostname?: string;
}

export async function runContainer(
  options: RunContainerOptions,
): Promise<RunResult> {
  const { imageName, hostPort, containerPort = DEFAULT_PORT, name, envVars, network, hostname } = options;
  try {
    await stopContainer(name);

    const allEnvVars = { PORT: String(containerPort), ...envVars };
    const envFlags = Object.entries(allEnvVars)
      .map(([k, v]) => `-e ${k}=${JSON.stringify(v)}`)
      .join(" ");
    const networkFlag = network ? `--network ${network}` : "";
    const hostnameFlag = hostname ? `--hostname ${hostname}` : "";
    const { stdout } = await execAsync(
      `docker run -d --name ${name} -p ${hostPort}:${containerPort} ${networkFlag} ${hostnameFlag} ${envFlags} ${imageName}`.replace(
        /\s+/g,
        " ",
      ),
    );
    const containerId = stdout.trim();
    return { success: true, containerId };
  } catch (err: any) {
    return {
      success: false,
      containerId: "",
      error: err.stderr || err.message,
    };
  }
}

export async function stopContainer(name: string): Promise<void> {
  try {
    await execAsync(`docker stop ${name}`);
    await execAsync(`docker rm ${name}`);
  } catch {
    // Container might not exist
  }
}

export async function getContainerStatus(containerId: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `docker inspect --format='{{.State.Status}}' ${containerId}`,
    );
    return stdout.trim().replace(/'/g, "");
  } catch {
    return "unknown";
  }
}

export async function waitForHealthy(
  containerId: string,
  maxAttempts: number = 30,
  intervalMs: number = 1000,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getContainerStatus(containerId);
    if (status === "running") {
      return true;
    }
    if (status === "exited" || status === "dead") {
      return false;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

export async function getAvailablePort(
  start: number = 10000,
  end: number = 20000,
): Promise<number> {
  const usedPorts = new Set<number>();

  try {
    const { stdout } = await execAsync(`docker ps --format '{{.Ports}}'`);
    const portMatches = stdout.matchAll(/0\.0\.0\.0:(\d+)/g);
    for (const match of portMatches) {
      usedPorts.add(parseInt(match[1], 10));
    }
  } catch {
    // Ignore errors
  }

  for (let port = start; port < end; port++) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }

  throw new Error("No available ports");
}

export async function networkExists(name: string): Promise<boolean> {
  try {
    await execAsync(`docker network inspect ${name}`);
    return true;
  } catch {
    return false;
  }
}

export async function createNetwork(name: string): Promise<void> {
  const exists = await networkExists(name);
  if (!exists) {
    await execAsync(`docker network create ${name}`);
  }
}

export async function removeNetwork(name: string): Promise<void> {
  try {
    await execAsync(`docker network rm ${name}`);
  } catch {
    // Network might not exist or have containers attached
  }
}
