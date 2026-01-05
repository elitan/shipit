import Link from "next/link";
import { StatusDot } from "@/components/status-dot";

interface ProjectCardProps {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  port: number;
  status?: string;
}

export function ProjectCard({
  id,
  name,
  repoUrl,
  branch,
  port,
  status,
}: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${id}`}
      className="group block rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800/50"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-neutral-100">{name}</h2>
        {status && <StatusDot status={status} showLabel />}
      </div>
      <p className="mt-1 font-mono text-sm text-neutral-500">{repoUrl}</p>
      <p className="mt-2 text-xs text-neutral-600">
        {branch} · port {port}
      </p>
    </Link>
  );
}
