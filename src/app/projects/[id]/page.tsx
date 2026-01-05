"use client";

import { ExternalLink, Loader2, Rocket, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { StatusDot } from "@/components/status-dot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeploymentRow } from "./_components/deployment-row";

interface Deployment {
  id: string;
  commit_sha: string;
  status: string;
  host_port: number | null;
  created_at: number;
  finished_at: number | null;
  build_log: string | null;
  error_message: string | null;
}

interface Project {
  id: string;
  name: string;
  repo_url: string;
  branch: string;
  dockerfile_path: string;
  port: number;
  deployments: Deployment[];
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [selectedDeployment, setSelectedDeployment] =
    useState<Deployment | null>(null);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setProject(data);
      if (data.deployments.length > 0 && !selectedDeployment) {
        setSelectedDeployment(data.deployments[0]);
      } else if (selectedDeployment) {
        const updated = data.deployments.find(
          (d: Deployment) => d.id === selectedDeployment.id,
        );
        if (updated) setSelectedDeployment(updated);
      }
    }
    setLoading(false);
  }, [params.id, selectedDeployment]);

  useEffect(() => {
    fetchProject();
    const interval = setInterval(fetchProject, 2000);
    return () => clearInterval(interval);
  }, [fetchProject]);

  async function handleDeploy() {
    setDeploying(true);
    const res = await fetch(`/api/projects/${params.id}/deploy`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success("Deployment started");
      await fetchProject();
    } else {
      toast.error("Failed to start deployment");
    }
    setDeploying(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this project?")) return;
    const res = await fetch(`/api/projects/${params.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Project deleted");
      router.push("/");
    } else {
      toast.error("Failed to delete project");
    }
  }

  if (loading) {
    return (
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
    );
  }

  if (!project)
    return <div className="text-neutral-400">Project not found</div>;

  const runningDeployment = project.deployments.find(
    (d) => d.status === "running",
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-neutral-100">
            {project.name}
          </h1>
          <p className="mt-1 font-mono text-sm text-neutral-500">
            {project.repo_url}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDeploy} disabled={deploying} size="sm">
            {deploying ? (
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
              {project.deployments.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No deployments"
                    description="Click Deploy to create one"
                  />
                </div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {project.deployments.map((d) => (
                    <DeploymentRow
                      key={d.id}
                      id={d.id}
                      commitSha={d.commit_sha}
                      status={d.status}
                      createdAt={d.created_at}
                      selected={selectedDeployment?.id === d.id}
                      onClick={() => setSelectedDeployment(d)}
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
            <div>
              <dt className="text-neutral-500">Branch</dt>
              <dd className="mt-1 font-mono text-neutral-300">
                {project.branch}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Dockerfile</dt>
              <dd className="mt-1 font-mono text-neutral-300">
                {project.dockerfile_path}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Container Port</dt>
              <dd className="mt-1 font-mono text-neutral-300">
                {project.port}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
