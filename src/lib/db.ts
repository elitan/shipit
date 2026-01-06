import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import pkg from "../../package.json";
import type { DB } from "./db-types";

const DB_PATH = join(process.cwd(), "data", "frost.db");

if (!existsSync(join(process.cwd(), "data"))) {
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = new Kysely<DB>({
  dialect: new SqliteDialect({ database: sqlite }),
});

function runMigrations() {
  const schema001 = join(process.cwd(), "schema", "001-init.sql");
  if (!existsSync(schema001)) {
    return;
  }

  const hasProjects = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'",
    )
    .get();

  if (!hasProjects) {
    const schema = readFileSync(schema001, "utf-8");
    sqlite.exec(schema);
    console.log("Applied 001-init migration");
  }

  const hasServices = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='services'",
    )
    .get();

  if (hasServices) {
    return;
  }

  const columns = sqlite.prepare("PRAGMA table_info(projects)").all() as Array<{
    name: string;
  }>;
  const columnNames = columns.map((c) => c.name);

  if (!columnNames.includes("env_vars")) {
    const schema002 = join(process.cwd(), "schema", "002-env-vars.sql");
    if (existsSync(schema002)) {
      const schema = readFileSync(schema002, "utf-8");
      sqlite.exec(schema);
      console.log("Applied 002-env-vars migration");
    }
  }

  if (!columnNames.includes("deploy_type")) {
    const schema003 = join(process.cwd(), "schema", "003-image-deploy.sql");
    if (existsSync(schema003)) {
      const schema = readFileSync(schema003, "utf-8");
      sqlite.exec(schema);
      console.log("Applied 003-image-deploy migration");
    }
  }

  const schema004 = join(process.cwd(), "schema", "004-multi-container.sql");
  if (existsSync(schema004)) {
    const schema = readFileSync(schema004, "utf-8");
    sqlite.exec(schema);
    console.log("Applied 004-multi-container migration");
  }

  const hasSettings = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'",
    )
    .get();

  if (!hasSettings) {
    const schema005 = join(process.cwd(), "schema", "005-settings.sql");
    if (existsSync(schema005)) {
      const schema = readFileSync(schema005, "utf-8");
      sqlite.exec(schema);
      console.log("Applied 005-settings migration");
    }
  }

  sqlite
    .prepare(
      "INSERT INTO settings (key, value) VALUES ('frost_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(pkg.version);
}

runMigrations();
