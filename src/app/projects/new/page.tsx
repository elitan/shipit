"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { BreadcrumbHeader } from "@/components/breadcrumb-header";
import { EnvVarEditor } from "@/components/env-var-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useCreateProject } from "@/hooks/use-projects";
import type { CreateProjectInput, EnvVar } from "@/lib/api";

export default function NewProjectPage() {
  const router = useRouter();
  const createMutation = useCreateProject();
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const validEnvVars = envVars.filter((v) => v.key.trim() !== "");

    const data: CreateProjectInput = {
      name: formData.get("name") as string,
      env_vars: validEnvVars,
    };

    try {
      const project = await createMutation.mutateAsync(data);
      toast.success("Project created");
      router.push(`/projects/${project.id}`);
    } catch {
      toast.error("Failed to create project");
    }
  }

  return (
    <>
      <BreadcrumbHeader items={[{ label: "New Project" }]} />
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-lg">
          <Card className="border-neutral-800 bg-neutral-900">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-neutral-100">
                New Project
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-3">
                  <Label htmlFor="name" className="text-neutral-300">
                    Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="my-project"
                    className="border-neutral-700 bg-neutral-800 text-neutral-100 placeholder:text-neutral-500"
                  />
                  <p className="text-xs text-neutral-500">
                    A project groups related services that share the same
                    network.
                  </p>
                </div>

                <Separator className="bg-neutral-800" />

                <div className="space-y-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                    Shared Environment Variables
                  </p>
                  <p className="text-xs text-neutral-500">
                    These variables will be inherited by all services in this
                    project.
                  </p>
                  <EnvVarEditor value={envVars} onChange={setEnvVars} />
                </div>

                <Separator className="bg-neutral-800" />

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    size="sm"
                  >
                    {createMutation.isPending ? (
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
      </main>
    </>
  );
}
