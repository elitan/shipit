"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingCard } from "./setting-card";

interface UpdateInfo {
  currentVersion: string;
  availableVersion: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  hasMigrations: boolean;
  htmlUrl: string | null;
  lastCheck: number | null;
}

export function SystemSection() {
  const [status, setStatus] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/updates")
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setError("Failed to load update status"));
  }, []);

  async function handleCheck() {
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/updates", { method: "POST" });
      const data = await res.json();
      setStatus(data);
    } catch {
      setError("Failed to check for updates");
    } finally {
      setChecking(false);
    }
  }

  async function handleApply() {
    if (!confirm("This will restart Frost to apply the update. Continue?")) {
      return;
    }

    setApplying(true);
    setError("");
    try {
      const res = await fetch("/api/updates/apply", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to apply update");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply update");
      setApplying(false);
    }
  }

  function formatLastCheck(timestamp: number | null): string {
    if (!timestamp) return "Never";
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  function formatPublishedAt(dateStr: string | null): string {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <SettingCard
      title="System"
      description="Check for updates and manage your Frost installation."
      learnMoreUrl={status?.htmlUrl || undefined}
      learnMoreText="View release notes"
      footer={
        status?.availableVersion ? (
          <Button onClick={handleApply} disabled={applying}>
            {applying ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Now"
            )}
          </Button>
        ) : (
          <Button variant="secondary" onClick={handleCheck} disabled={checking}>
            {checking ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Check for Updates
              </>
            )}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-400">Current Version</p>
            <p className="text-lg font-medium text-neutral-100">
              v{status?.currentVersion || "..."}
            </p>
          </div>
          <p className="text-xs text-neutral-500">
            Last checked: {formatLastCheck(status?.lastCheck ?? null)}
          </p>
        </div>

        {status?.availableVersion && (
          <div className="rounded-lg border border-blue-800 bg-blue-900/20 p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-blue-400">
                Update Available: v{status.availableVersion}
              </p>
              {status.publishedAt && (
                <p className="text-xs text-neutral-400">
                  Released {formatPublishedAt(status.publishedAt)}
                </p>
              )}
            </div>

            {status.hasMigrations && (
              <div className="mt-3 flex items-start gap-2 rounded bg-yellow-900/30 p-2 text-yellow-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-xs">
                  This update includes database migrations. Back up your data
                  before updating.
                </p>
              </div>
            )}
          </div>
        )}

        {status && !status.availableVersion && (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">You're running the latest version</span>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </SettingCard>
  );
}
