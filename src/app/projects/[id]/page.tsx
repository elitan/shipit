"use client";

import { Loader2, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { BreadcrumbHeader } from "@/components/breadcrumb-header";
import { EmptyState } from "@/components/empty-state";
import { EnvVarEditor } from "@/components/env-var-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteProject,
  useDeployProject,
  useProject,
  useUpdateProject,
} from "@/hooks/use-projects";
import { useDeleteService } from "@/hooks/use-services";
import type { EnvVar } from "@/lib/api";
import { ServiceCard } from "./_components/service-card";

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { data: project, isLoading } = useProject(projectId);
  const deployProjectMutation = useDeployProject(projectId);
  const deleteMutation = useDeleteProject();
  const updateMutation = useUpdateProject(projectId);
  const deleteServiceMutation = useDeleteService(projectId);

  const [editingEnv, setEditingEnv] = useState(false);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);

  async function handleDeployAll() {
    try {
      await deployProjectMutation.mutateAsync();
      toast.success("Deploying all services");
    } catch {
      toast.error("Failed to start deployment");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this project and all its services?")) return;
    try {
      await deleteMutation.mutateAsync(projectId);
      toast.success("Project deleted");
      router.push("/");
    } catch {
      toast.error("Failed to delete project");
    }
  }

  async function handleDeleteService(serviceId: string) {
    if (!confirm("Delete this service?")) return;
    try {
      await deleteServiceMutation.mutateAsync(serviceId);
      toast.success("Service deleted");
    } catch {
      toast.error("Failed to delete service");
    }
  }

  function handleEditEnv() {
    if (project) {
      setEnvVars(project.env_vars ? JSON.parse(project.env_vars) : []);
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
        <BreadcrumbHeader items={[{ label: "..." }]} />
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
          </div>
        </main>
      </>
    );
  }

  if (!project)
    return (
      <>
        <BreadcrumbHeader items={[]} />
        <main className="container mx-auto px-4 py-8">
          <div className="text-neutral-400">Project not found</div>
        </main>
      </>
    );

  const services = project.services || [];
  const hasServices = services.length > 0;

  return (
    <>
      <BreadcrumbHeader items={[{ label: project.name }]} />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-medium text-neutral-100">
                {project.name}
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                {services.length} service{services.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${projectId}/services/new`}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Service
                </Link>
              </Button>
              {hasServices && (
                <Button
                  onClick={handleDeployAll}
                  disabled={deployProjectMutation.isPending}
                  size="sm"
                >
                  {deployProjectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Deploying
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-1.5 h-4 w-4" />
                      Deploy All
                    </>
                  )}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 text-neutral-500" />
              </Button>
            </div>
          </div>

          {!hasServices ? (
            <Card className="bg-neutral-900 border-neutral-800">
              <CardContent className="py-12">
                <EmptyState
                  title="No services yet"
                  description="Add a service to get started with deployments"
                  action={
                    <Button asChild size="sm">
                      <Link href={`/projects/${projectId}/services/new`}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Add Service
                      </Link>
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  projectId={projectId}
                  onDelete={() => handleDeleteService(service.id)}
                />
              ))}
            </div>
          )}

          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-neutral-300">
                <span>Shared Environment Variables</span>
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
                These variables are inherited by all services in this project.
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
                    const vars: EnvVar[] = project.env_vars
                      ? JSON.parse(project.env_vars)
                      : [];
                    if (vars.length === 0) {
                      return (
                        <p className="text-sm text-neutral-500">
                          No shared environment variables configured
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
