import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/lib/db";
import {
  createSystemDomain,
  getServerIp,
  getSystemDomainForService,
} from "../src/lib/domains";

const DB_PATH = join(process.cwd(), "data", "frost.db");

if (!existsSync(join(process.cwd(), "data"))) {
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL");
sqlite.exec("PRAGMA foreign_keys = ON");

const schemaDir = join(process.cwd(), "schema");
if (!existsSync(schemaDir)) {
  console.log("No schema directory found");
  process.exit(0);
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at INTEGER NOT NULL
  )
`);

const migrationFiles = readdirSync(schemaDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const applied = sqlite.prepare("SELECT name FROM _migrations").all() as Array<{
  name: string;
}>;
const appliedSet = new Set(applied.map((r) => r.name));

const hasExistingDb = sqlite
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'",
  )
  .get();

if (hasExistingDb && appliedSet.size === 0) {
  const now = Date.now();
  const insert = sqlite.prepare(
    "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
  );
  for (const file of migrationFiles) {
    insert.run(file, now);
  }
  console.log(`Bootstrapped ${migrationFiles.length} existing migrations`);
  sqlite.close();
  process.exit(0);
}

let appliedCount = 0;
for (const file of migrationFiles) {
  if (appliedSet.has(file)) {
    continue;
  }

  const filePath = join(schemaDir, file);
  const sql = readFileSync(filePath, "utf-8");

  sqlite.exec("BEGIN TRANSACTION");
  try {
    sqlite.exec(sql);
    sqlite
      .prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)")
      .run(file, Date.now());
    sqlite.exec("COMMIT");
    console.log(`Applied migration: ${file}`);
    appliedCount++;
  } catch (err) {
    sqlite.exec("ROLLBACK");
    throw err;
  }
}

if (appliedCount === 0) {
  console.log("No new migrations to apply");
} else {
  console.log(`Applied ${appliedCount} migrations`);
}

sqlite.close();

async function ensureSystemDomains() {
  if (process.env.NODE_ENV === "development") {
    console.log("Development mode, skipping system domain creation");
    return;
  }

  let serverIp: string;
  try {
    serverIp = await getServerIp();
  } catch {
    console.log("Could not determine server IP, skipping system domain creation");
    return;
  }
  console.log(`Server IP: ${serverIp}`);

  const services = await db
    .selectFrom("services")
    .innerJoin("projects", "projects.id", "services.project_id")
    .select([
      "services.id",
      "services.name",
      "projects.name as project_name",
    ])
    .execute();

  let created = 0;
  for (const svc of services) {
    const existing = await getSystemDomainForService(svc.id);
    if (!existing) {
      await createSystemDomain(svc.id, svc.name, svc.project_name);
      created++;
    }
  }

  if (created > 0) {
    console.log(`Created ${created} system domain(s)`);
  }
}

ensureSystemDomains()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to ensure system domains:", err);
    process.exit(1);
  });
