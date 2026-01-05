import { StatusDot } from "@/components/status-dot";
import { cn } from "@/lib/utils";

interface DeploymentRowProps {
  id: string;
  commitSha: string;
  status: string;
  createdAt: number;
  selected: boolean;
  onClick: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function DeploymentRow({
  commitSha,
  status,
  createdAt,
  selected,
  onClick,
}: DeploymentRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 transition-colors",
        "hover:bg-neutral-800/50",
        selected && "bg-neutral-800",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-neutral-300">{commitSha}</span>
        <StatusDot status={status} />
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {formatRelativeTime(createdAt)}
      </p>
    </button>
  );
}
