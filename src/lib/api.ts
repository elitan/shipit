export interface ProjectLatestDeployment {
  status: string;
  commit_message: string | null;
  created_at: number;
  branch: string | null;
}

export interface Project {
  id: string;
  name: string;
  env_vars: string;
  created_at: number;
  services?: Service[];
  servicesCount?: number;
  latestDeployment?: ProjectLatestDeployment | null;
  repoUrl?: string | null;
  runningUrl?: string | null;
}

export interface Service {
  id: string;
  project_id: string;
  name: string;
  deploy_type: "repo" | "image";
  repo_url: string | null;
  branch: string | null;
  dockerfile_path: string | null;
  image_url: string | null;
  env_vars: string;
  container_port: number | null;
  created_at: number;
  latestDeployment?: Deployment;
}

export interface Deployment {
  id: string;
  project_id: string;
  service_id: string;
  commit_sha: string;
  commit_message: string | null;
  status: string;
  host_port: number | null;
  created_at: number;
  finished_at: number | null;
  build_log: string | null;
  error_message: string | null;
}

export interface EnvVar {
  key: string;
  value: string;
}

export interface Domain {
  id: string;
  service_id: string;
  domain: string;
  type: "proxy" | "redirect";
  redirect_target: string | null;
  redirect_code: number | null;
  dns_verified: number;
  ssl_status: "pending" | "active" | "failed";
  created_at: number;
}

export interface AddDomainInput {
  domain: string;
  type?: "proxy" | "redirect";
  redirectTarget?: string;
  redirectCode?: 301 | 307;
}

export interface UpdateDomainInput {
  type?: "proxy" | "redirect";
  redirectTarget?: string;
  redirectCode?: 301 | 307;
}

export interface DnsStatus {
  valid: boolean;
  serverIp: string;
  domainIp: string | null;
  dnsVerified: boolean;
}

export interface Settings {
  domain: string | null;
  email: string | null;
  ssl_enabled: string | null;
  server_ip: string | null;
}

export interface CreateProjectInput {
  name: string;
  env_vars?: EnvVar[];
}

export interface UpdateProjectInput {
  name?: string;
  env_vars?: EnvVar[];
}

export interface CreateServiceInput {
  name: string;
  deploy_type: "repo" | "image";
  repo_url?: string;
  branch?: string;
  dockerfile_path?: string;
  image_url?: string;
  env_vars?: EnvVar[];
  container_port?: number;
}

export interface UpdateServiceInput {
  name?: string;
  env_vars?: EnvVar[];
  branch?: string;
  dockerfile_path?: string;
  repo_url?: string;
  image_url?: string;
  container_port?: number;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }
  return res.json();
}

export const api = {
  projects: {
    list: (): Promise<Project[]> =>
      fetch("/api/projects").then((r) => handleResponse<Project[]>(r)),

    get: (id: string): Promise<Project> =>
      fetch(`/api/projects/${id}`).then((r) => handleResponse<Project>(r)),

    create: (data: CreateProjectInput): Promise<Project> =>
      fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => handleResponse<Project>(r)),

    update: (id: string, data: UpdateProjectInput): Promise<Project> =>
      fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => handleResponse<Project>(r)),

    delete: (id: string): Promise<{ success: boolean }> =>
      fetch(`/api/projects/${id}`, { method: "DELETE" }).then((r) =>
        handleResponse<{ success: boolean }>(r),
      ),

    deploy: (id: string): Promise<{ deployment_ids: string[] }> =>
      fetch(`/api/projects/${id}/deploy`, { method: "POST" }).then((r) =>
        handleResponse<{ deployment_ids: string[] }>(r),
      ),
  },

  services: {
    list: (projectId: string): Promise<Service[]> =>
      fetch(`/api/projects/${projectId}/services`).then((r) =>
        handleResponse<Service[]>(r),
      ),

    get: (id: string): Promise<Service> =>
      fetch(`/api/services/${id}`).then((r) => handleResponse<Service>(r)),

    create: (projectId: string, data: CreateServiceInput): Promise<Service> =>
      fetch(`/api/projects/${projectId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => handleResponse<Service>(r)),

    update: (id: string, data: UpdateServiceInput): Promise<Service> =>
      fetch(`/api/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => handleResponse<Service>(r)),

    delete: (id: string): Promise<{ success: boolean }> =>
      fetch(`/api/services/${id}`, { method: "DELETE" }).then((r) =>
        handleResponse<{ success: boolean }>(r),
      ),

    deploy: (id: string): Promise<{ deployment_id: string }> =>
      fetch(`/api/services/${id}/deploy`, { method: "POST" }).then((r) =>
        handleResponse<{ deployment_id: string }>(r),
      ),
  },

  deployments: {
    get: (id: string): Promise<Deployment> =>
      fetch(`/api/deployments/${id}`).then((r) =>
        handleResponse<Deployment>(r),
      ),

    listByService: (serviceId: string): Promise<Deployment[]> =>
      fetch(`/api/services/${serviceId}/deployments`).then((r) =>
        handleResponse<Deployment[]>(r),
      ),
  },

  domains: {
    list: (serviceId: string): Promise<Domain[]> =>
      fetch(`/api/services/${serviceId}/domains`).then((r) =>
        handleResponse<Domain[]>(r),
      ),

    get: (id: string): Promise<Domain> =>
      fetch(`/api/domains/${id}`).then((r) => handleResponse<Domain>(r)),

    add: (serviceId: string, data: AddDomainInput): Promise<Domain> =>
      fetch(`/api/services/${serviceId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => handleResponse<Domain>(r)),

    update: (id: string, data: UpdateDomainInput): Promise<Domain> =>
      fetch(`/api/domains/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => handleResponse<Domain>(r)),

    delete: (id: string): Promise<{ success: boolean }> =>
      fetch(`/api/domains/${id}`, { method: "DELETE" }).then((r) =>
        handleResponse<{ success: boolean }>(r),
      ),

    verifyDns: (id: string): Promise<DnsStatus> =>
      fetch(`/api/domains/${id}/verify-dns`, { method: "POST" }).then((r) =>
        handleResponse<DnsStatus>(r),
      ),
  },

  settings: {
    get: (): Promise<Settings> =>
      fetch("/api/settings").then((r) => handleResponse<Settings>(r)),
  },
};
