import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { join } from "node:path";

let spawnMock: ReturnType<typeof mock>;
let execMock: ReturnType<typeof mock>;
let capturedArgs: string[] = [];
let capturedOptions: { cwd?: string } = {};
let capturedExecCmd: string = "";

beforeEach(() => {
  capturedArgs = [];
  capturedOptions = {};
  capturedExecCmd = "";

  spawnMock = mock((cmd: string, args: string[], options: { cwd?: string }) => {
    capturedArgs = args;
    capturedOptions = options;
    return {
      stdout: { on: mock(() => {}) },
      stderr: { on: mock(() => {}) },
      on: mock((event: string, callback: (code: number) => void) => {
        if (event === "close") {
          setTimeout(() => callback(0), 0);
        }
      }),
    };
  });

  execMock = mock(
    (
      cmd: string,
      callback: (err: Error | null, result: { stdout: string }) => void,
    ) => {
      capturedExecCmd = cmd;
      callback(null, { stdout: "container-id-123" });
    },
  );

  mock.module("node:child_process", () => ({
    spawn: spawnMock,
    exec: execMock,
  }));
});

afterEach(() => {
  mock.restore();
});

describe("buildImage", () => {
  test("uses dockerfile directory as build context for nested path", async () => {
    const { buildImage } = await import("./docker");

    const repoPath = "/repos/test-service";
    const dockerfilePath = "test/fixtures/simple-node/Dockerfile";

    await buildImage(repoPath, "test-image:latest", dockerfilePath);

    expect(capturedArgs).toContain("-f");
    const fIndex = capturedArgs.indexOf("-f");
    expect(capturedArgs[fIndex + 1]).toBe("Dockerfile");

    expect(capturedOptions.cwd).toBe(
      join(repoPath, "test/fixtures/simple-node"),
    );
  });

  test("uses repo root as context for root-level Dockerfile", async () => {
    const { buildImage } = await import("./docker");

    const repoPath = "/repos/test-service";
    const dockerfilePath = "Dockerfile";

    await buildImage(repoPath, "test-image:latest", dockerfilePath);

    expect(capturedArgs).toContain("-f");
    const fIndex = capturedArgs.indexOf("-f");
    expect(capturedArgs[fIndex + 1]).toBe("Dockerfile");

    expect(capturedOptions.cwd).toBe(repoPath);
  });

  test("handles subdirectory dockerfile path", async () => {
    const { buildImage } = await import("./docker");

    const repoPath = "/repos/test-service";
    const dockerfilePath = "docker/Dockerfile.prod";

    await buildImage(repoPath, "test-image:latest", dockerfilePath);

    expect(capturedArgs).toContain("-f");
    const fIndex = capturedArgs.indexOf("-f");
    expect(capturedArgs[fIndex + 1]).toBe("Dockerfile.prod");

    expect(capturedOptions.cwd).toBe(join(repoPath, "docker"));
  });
});

describe("runContainer", () => {
  test("injects PORT=8080 env var", async () => {
    const { runContainer } = await import("./docker");

    await runContainer({
      imageName: "test-image:latest",
      hostPort: 10001,
      name: "test-container",
    });

    expect(capturedExecCmd).toContain("-e PORT=");
    expect(capturedExecCmd).toContain('"8080"');
  });

  test("uses port 8080 for container port mapping", async () => {
    const { runContainer } = await import("./docker");

    await runContainer({
      imageName: "test-image:latest",
      hostPort: 10001,
      name: "test-container",
    });

    expect(capturedExecCmd).toContain("-p 10001:8080");
  });

  test("allows user to override PORT env var", async () => {
    const { runContainer } = await import("./docker");

    await runContainer({
      imageName: "test-image:latest",
      hostPort: 10001,
      name: "test-container",
      envVars: { PORT: "3000", MY_VAR: "value" },
    });

    expect(capturedExecCmd).toContain('"3000"');
    expect(capturedExecCmd).toContain("MY_VAR=");
  });

  test("includes network and hostname flags", async () => {
    const { runContainer } = await import("./docker");

    await runContainer({
      imageName: "test-image:latest",
      hostPort: 10001,
      name: "test-container",
      network: "frost-net-123",
      hostname: "my-service",
    });

    expect(capturedExecCmd).toContain("--network frost-net-123");
    expect(capturedExecCmd).toContain("--hostname my-service");
  });

  test("includes restart policy", async () => {
    const { runContainer } = await import("./docker");

    await runContainer({
      imageName: "test-image:latest",
      hostPort: 10001,
      name: "test-container",
    });

    expect(capturedExecCmd).toContain("--restart on-failure:5");
  });
});
