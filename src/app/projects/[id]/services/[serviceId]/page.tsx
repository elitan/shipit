"use client";

import { ExternalLink, Loader2, Pencil, Rocket, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BreadcrumbHeader } from "@/components/breadcrumb-header";
import { EmptyState } from "@/components/empty-state";
import { EnvVarEditor } from "@/components/env-var-editor";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/use-projects";
import {
  useDeleteService,
  useDeployService,
  useService,
  useUpdateService,
} from "@/hooks/use-services";
import type { Deployment, EnvVar } from "@/lib/api";
import { api } from "@/lib/api";
import { DeploymentRow } from "./_components/deployment-row";

export default function ServicePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const serviceId = params.serviceId as string;

  const { data: project } = useProject(projectId);
  const { data: service, isLoading } = useService(serviceId);
  const deployMutation = useDeployService(serviceId, projectId);
  const deleteMutation = useDeleteService(projectId);
  const updateMutation = useUpdateService(serviceId, projectId);

  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedDeployment, setSelectedDeployment] =
    useState<Deployment | null>(null);
  const selectedDeploymentRef = useRef<string | null>(null);
  const [editingEnv, setEditingEnv] = useState(false);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);

  useEffect(() => {
    if (!service) return;
    async function fetchDeployments() {
      const deps = await api.deployments.listByService(serviceId);
      setDeployments(deps);
    }
    fetchDeployments();
    const interval = setInterval(fetchDeployments, 2000);
    return () => clearInterval(interval);
  }, [service, serviceId]);

  useEffect(() => {
    if (deployments.length === 0) {
      setSelectedDeployment(null);
      return;
    }
    if (!selectedDeploymentRef.current) {
      setSelectedDeployment(deployments[0]);
      selectedDeploymentRef.current = deployments[0].id;
    } else {
      const updated = deployments.find(
        (d) => d.id === selectedDeploymentRef.current,
      );
      if (updated) setSelectedDeployment(updated);
    }
  }, [deployments]);

  function handleSelectDeployment(d: Deployment) {
    setSelectedDeployment(d);
    selectedDeploymentRef.current = d.id;
  }

  async function handleDeploy() {
    try {
      await deployMutation.mutateAsync();
      toast.success("Deployment started");
    } catch {
      toast.error("Failed to start deployment");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this service?")) return;
    try {
      await deleteMutation.mutateAsync(serviceId);
      toast.success("Service deleted");
      router.push(`/projects/${projectId}`);
    } catch {
      toast.error("Failed to delete service");
    }
  }

  function handleEditEnv() {
    if (service) {
      setEnvVars(service.env_vars ? JSON.parse(service.env_vars) : []);
      setEditingEnv(true);
    }
  }

  async function handleSaveEnv() {
    const validEnvVars = envVars.filter((v) => v.key.trim() !== "");
    try {
      await updateMutation.mutateAsync({ env_vars: validEnvVars });
      toast.success("Environment variables saved");
      setEditingEnv(false);
    } catch {
      toast.error("Failed to save");
    }
  }

  if (isLoading) {
    return (
      <>
        <BreadcrumbHeader
          items={[
            { label: project?.name ?? "...", href: `/projects/${projectId}` },
            { label: "..." },
          ]}
        />
        <main className="container mx-auto px-4 py-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-7 w-48" />
                <Skeleton className="mt-2 h-4 w-64" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-3 gap-6">
              <Skeleton className="h-64" />
              <Skeleton className="col-span-2 h-64" />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!service)
    return (
      <>
        <BreadcrumbHeader
          items={[
            { label: project?.name ?? "...", href: `/projects/${projectId}` },
          ]}
        />
        <main className="container mx-auto px-4 py-8">
          <div className="text-neutral-400">Service not found</div>
        </main>
      </>
    );

  const runningDeployment = deployments.find((d) => d.status === "running");

  return (
    <>
      <BreadcrumbHeader
        items={[
          { label: project?.name ?? "...", href: `/projects/${projectId}` },
          { label: service.name },
        ]}
      />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-medium text-neutral-100">
                {service.name}
              </h1>
              <p className="mt-1 font-mono text-sm text-neutral-500">
                {service.deploy_type === "image"
                  ? service.image_url
                  : service.repo_url}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleDeploy}
                disabled={deployMutation.isPending}
                size="sm"
              >
                {deployMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Deploying
                  </>
                ) : (
                  <>
                    <Rocket className="mr-1.5 h-4 w-4" />
                    Deploy
                  </>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 text-neutral-500" />
              </Button>
            </div>
          </div>

          {runningDeployment && (
            <Card className="border-l-2 border-l-green-500 bg-neutral-900 border-neutral-800">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusDot status="running" />
                    <span className="text-sm text-neutral-300">
                      Running on port {runningDeployment.host_port}
                    </span>
                  </div>
                  <a
                    href={`http://localhost:${runningDeployment.host_port}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
                  >
                    Open
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <p className="mt-1 font-mono text-xs text-neutral-500">
                  {runningDeployment.commit_sha}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1">
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-300">
                    Deployments
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {deployments.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        title="No deployments"
                        description="Click Deploy to create one"
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-800">
                      {deployments.map((d) => (
                        <DeploymentRow
                          key={d.id}
                          id={d.id}
                          commitSha={d.commit_sha}
                          status={d.status}
                          createdAt={d.created_at}
                          selected={selectedDeployment?.id === d.id}
                          onClick={() => handleSelectDeployment(d)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="col-span-2">
              {selectedDeployment && (
                <Card className="bg-neutral-900 border-neutral-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm font-medium text-neutral-300">
                      <span>Build Log</span>
                      <StatusDot status={selectedDeployment.status} showLabel />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedDeployment.error_message && (
                      <div className="mb-4 rounded border border-red-900 bg-red-950/50 p-3 text-sm text-red-400">
                        {selectedDeployment.error_message}
                      </div>
                    )}
                    <pre className="max-h-96 overflow-auto rounded bg-neutral-950 p-4 font-mono text-xs text-neutral-400">
                      {selectedDeployment.build_log || "No logs yet..."}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-300">
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-4 text-sm">
                {service.deploy_type === "repo" ? (
                  <>
                    <div>
                      <dt className="text-neutral-500">Branch</dt>
                      <dd className="mt-1 font-mono text-neutral-300">
                        {service.branch}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Dockerfile</dt>
                      <dd className="mt-1 font-mono text-neutral-300">
                        {service.dockerfile_path}
                      </dd>
                    </div>
                  </>
                ) : (
                  <div>
                    <dt className="text-neutral-500">Image</dt>
                    <dd className="mt-1 font-mono text-neutral-300">
                      {service.image_url}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-neutral-500">Container Port</dt>
                  <dd className="mt-1 font-mono text-neutral-300">
                    {service.port}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-neutral-300">
                <span>Service Environment Variables</span>
                {!editingEnv && (
                  <Button variant="ghost" size="sm" onClick={handleEditEnv}>
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-xs text-neutral-500">
                These are specific to this service (in addition to project-level
                vars).
              </p>
              {editingEnv ? (
                <div className="space-y-4">
                  <EnvVarEditor value={envVars} onChange={setEnvVars} />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveEnv}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          Saving
                        </>
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingEnv(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const vars: EnvVar[] = service.env_vars
                      ? JSON.parse(service.env_vars)
                      : [];
                    if (vars.length === 0) {
                      return (
                        <p className="text-sm text-neutral-500">
                          No service-specific environment variables
                        </p>
                      );
                    }
                    return vars.map((v) => (
                      <div key={v.key} className="flex gap-2 font-mono text-sm">
                        <span className="text-neutral-300">{v.key}</span>
                        <span className="text-neutral-600">=</span>
                        <span className="text-neutral-500">••••••••</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
