"use client";

import { Plus, Rocket } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "./_components/project-card";
import { SkeletonCard } from "./_components/skeleton-card";

interface Project {
  id: string;
  name: string;
  repo_url: string;
  branch: string;
  port: number;
  latestStatus?: string;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
      setLoading(false);
    }
    fetchProjects();
  }, []);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-lg font-medium">Projects</h1>
        <Button asChild size="sm">
          <Link href="/projects/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No projects yet"
          description="Deploy your first application"
          action={{ label: "New Project", href: "/projects/new" }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              name={project.name}
              repoUrl={project.repo_url}
              branch={project.branch}
              port={project.port}
              status={project.latestStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
