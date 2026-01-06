"use client";

import { Plus, Rocket } from "lucide-react";
import Link from "next/link";
import { BreadcrumbHeader } from "@/components/breadcrumb-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useProjects } from "@/hooks/use-projects";
import { ProjectCard } from "./_components/project-card";
import { SkeletonCard } from "./_components/skeleton-card";

export default function Home() {
  const { data: projects, isLoading } = useProjects();

  return (
    <>
      <BreadcrumbHeader items={[]} />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-lg font-medium">Projects</h1>
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : !projects || projects.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="No projects yet"
            description="Create a project to get started"
            action={{ label: "New Project", href: "/projects/new" }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                name={project.name}
                servicesCount={project.servicesCount ?? 0}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
