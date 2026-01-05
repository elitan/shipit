export interface EnvVar {
  key: string;
  value: string;
}

export type DeployType = "repo" | "image";

export interface ProjectsTable {
  id: string;
  name: string;
  repo_url: string | null;
  branch: string | null;
  dockerfile_path: string | null;
  port: number;
  env_vars: string;
  image_url: string | null;
  deploy_type: DeployType;
  created_at: number;
}

export interface DeploymentsTable {
  id: string;
  project_id: string;
  commit_sha: string;
  commit_message: string | null;
  status: string;
  container_id: string | null;
  host_port: number | null;
  build_log: string | null;
  error_message: string | null;
  created_at: number;
  finished_at: number | null;
}

export interface DB {
  projects: ProjectsTable;
  deployments: DeploymentsTable;
}
