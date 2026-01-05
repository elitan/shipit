import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
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
  const schemaPath = join(process.cwd(), "schema", "001-init.sql");
  if (!existsSync(schemaPath)) {
    return;
  }

  const result = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'",
    )
    .get();

  if (result) {
    return;
  }

  const schema = readFileSync(schemaPath, "utf-8");
  sqlite.exec(schema);
  console.log("Database migrated");
}

runMigrations();
