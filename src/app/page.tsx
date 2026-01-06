"use client";

import { Plus, Rocket, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BreadcrumbHeader } from "@/components/breadcrumb-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjects } from "@/hooks/use-projects";
import { ProjectCard } from "./_components/project-card";
import { SkeletonCard } from "./_components/skeleton-card";

export default function Home() {
  const { data: projects, isLoading } = useProjects();
  const [search, setSearch] = useState("");

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (!search) return projects;
    const lower = search.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(lower));
  }, [projects, search]);

  return (
    <>
      <BreadcrumbHeader items={[]} />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <Input
              placeholder="Search Projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Add New...
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
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching projects"
            description="Try a different search term"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                id={project.id}
                name={project.name}
                runningUrl={project.runningUrl}
                repoUrl={project.repoUrl}
                latestDeployment={project.latestDeployment}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
