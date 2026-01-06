import type { ColumnType } from 'kysely';

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type ArrayType<T> = ArrayTypeImpl<T> extends (infer U)[]
  ? U[]
  : ArrayTypeImpl<T>;

export type ArrayTypeImpl<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S[], I[], U[]>
  : T[];

export type JsonPrimitive = string | number | boolean | null;

export type JsonArray = JsonValue[];

export type JsonObject = { [key: string]: JsonValue };

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export interface Deployment {
  id: string;
  project_id: string;
  service_id: string;
  commit_sha: string;
  commit_message: string | null;
  status: Generated<string>;
  container_id: string | null;
  host_port: number | null;
  build_log: string | null;
  error_message: string | null;
  created_at: number;
  finished_at: number | null;
}

export interface Project {
  id: string;
  name: string;
  env_vars: Generated<string>;
  created_at: number;
}

export interface Service {
  id: string;
  project_id: string;
  name: string;
  deploy_type: Generated<string>;
  repo_url: string | null;
  branch: Generated<string | null>;
  dockerfile_path: Generated<string | null>;
  image_url: string | null;
  env_vars: Generated<string>;
  created_at: number;
}

export interface Setting {
  key: string;
  value: string;
}

export interface DB {
  deployments: Deployment;
  projects: Project;
  services: Service;
  settings: Setting;
}
