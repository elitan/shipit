"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EnvVarEditor } from "@/components/env-var-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type DeployType = "repo" | "image";

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deployType, setDeployType] = useState<DeployType>("repo");
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const validEnvVars = envVars.filter((v) => v.key.trim() !== "");

    const data: Record<string, unknown> = {
      name: formData.get("name"),
      deploy_type: deployType,
      port: parseInt(formData.get("port") as string, 10) || 3000,
      env_vars: validEnvVars,
    };

    if (deployType === "repo") {
      data.repo_url = formData.get("repo_url");
      data.branch = formData.get("branch") || "main";
      data.dockerfile_path = formData.get("dockerfile_path") || "Dockerfile";
    } else {
      data.image_url = formData.get("image_url");
    }

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      const project = await res.json();
      toast.success("Project created");
      router.push(`/projects/${project.id}`);
    } else {
      setLoading(false);
      toast.error("Failed to create project");
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card className="border-neutral-800 bg-neutral-900">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-neutral-100">
            New Project
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="grid gap-3">
                <Label htmlFor="name" className="text-neutral-300">
                  Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="my-app"
                  className="border-neutral-700 bg-neutral-800 text-neutral-100 placeholder:text-neutral-500"
                />
              </div>

              <div className="grid gap-3">
                <Label className="text-neutral-300">Deploy Type</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deploy_type"
                      value="repo"
                      checked={deployType === "repo"}
                      onChange={() => setDeployType("repo")}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-neutral-300">
                      Build from Repository
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deploy_type"
                      value="image"
                      checked={deployType === "image"}
                      onChange={() => setDeployType("image")}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-neutral-300">
                      Use Docker Image
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <Separator className="bg-neutral-800" />

            {deployType === "repo" ? (
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  Repository Settings
                </p>

                <div className="grid gap-3">
                  <Label htmlFor="repo_url" className="text-neutral-300">
                    Repository URL
                  </Label>
                  <Input
                    id="repo_url"
                    name="repo_url"
                    required
                    placeholder="https://github.com/user/repo"
                    className="border-neutral-700 bg-neutral-800 font-mono text-sm text-neutral-100 placeholder:text-neutral-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-3">
                    <Label htmlFor="branch" className="text-neutral-300">
                      Branch
                    </Label>
                    <Input
                      id="branch"
                      name="branch"
                      placeholder="main"
                      defaultValue="main"
                      className="border-neutral-700 bg-neutral-800 font-mono text-sm text-neutral-100 placeholder:text-neutral-500"
                    />
                  </div>

                  <div className="grid gap-3">
                    <Label
                      htmlFor="dockerfile_path"
                      className="text-neutral-300"
                    >
                      Dockerfile
                    </Label>
                    <Input
                      id="dockerfile_path"
                      name="dockerfile_path"
                      placeholder="Dockerfile"
                      defaultValue="Dockerfile"
                      className="border-neutral-700 bg-neutral-800 font-mono text-sm text-neutral-100 placeholder:text-neutral-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                  Image Settings
                </p>

                <div className="grid gap-3">
                  <Label htmlFor="image_url" className="text-neutral-300">
                    Image
                  </Label>
                  <Input
                    id="image_url"
                    name="image_url"
                    required
                    placeholder="nginx:alpine"
                    className="border-neutral-700 bg-neutral-800 font-mono text-sm text-neutral-100 placeholder:text-neutral-500"
                  />
                  <p className="text-xs text-neutral-500">
                    Docker Hub image or full registry URL (e.g.,
                    ghcr.io/user/image:tag)
                  </p>
                </div>
              </div>
            )}

            <Separator className="bg-neutral-800" />

            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Container Settings
              </p>
              <div className="grid gap-3">
                <Label htmlFor="port" className="text-neutral-300">
                  Container Port
                </Label>
                <Input
                  id="port"
                  name="port"
                  type="number"
                  placeholder="3000"
                  defaultValue="3000"
                  className="w-32 border-neutral-700 bg-neutral-800 font-mono text-sm text-neutral-100 placeholder:text-neutral-500"
                />
              </div>
            </div>

            <Separator className="bg-neutral-800" />

            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Environment Variables
              </p>
              <EnvVarEditor value={envVars} onChange={setEnvVars} />
            </div>

            <Separator className="bg-neutral-800" />

            <div className="flex gap-2">
              <Button type="submit" disabled={loading} size="sm">
                {loading ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Creating
                  </>
                ) : (
                  "Create Project"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
