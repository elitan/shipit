"use client";

import { CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingCard } from "../../_components/setting-card";

interface CleanupResult {
  success: boolean;
  deletedImages: string[];
  deletedNetworks: string[];
  prunedContainers: number;
  freedBytes: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
}

interface CleanupSettings {
  enabled: boolean;
  keepImages: number;
  pruneDangling: boolean;
  pruneNetworks: boolean;
  running: boolean;
  lastRun: string | null;
  lastResult: CleanupResult | null;
}

export function CleanupSection() {
  const [settings, setSettings] = useState<CleanupSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch("/api/cleanup")
      .then((res) => res.json())
      .then(setSettings)
      .catch(() => setError("Failed to load cleanup settings"));
  }, []);

  useEffect(() => {
    if (!settings?.running) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/cleanup/run");
        const data = await res.json();
        if (!data.running) {
          setSettings((s) =>
            s
              ? {
                  ...s,
                  running: false,
                  lastRun: data.lastRun,
                  lastResult: data.result,
                }
              : s,
          );
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [settings?.running]);

  async function handleSave(updates: Partial<CleanupSettings>) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      setSettings(data);
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setError("");
    try {
      const res = await fetch("/api/cleanup/run", { method: "POST" });
      if (res.status === 409) {
        setError("Cleanup already running");
        return;
      }
      setSettings((s) => (s ? { ...s, running: true } : s));
    } catch {
      setError("Failed to start cleanup");
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  }

  if (!settings) {
    return (
      <SettingCard
        title="Docker Cleanup"
        description="Automatically remove old images, containers, and networks."
      >
        <div className="flex items-center gap-2 text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      </SettingCard>
    );
  }

  return (
    <SettingCard
      title="Docker Cleanup"
      description="Automatically remove old images, containers, and networks to free disk space."
      footer={
        <Button
          onClick={handleRunNow}
          disabled={settings.running || saving}
          variant="secondary"
        >
          {settings.running ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-1.5 h-4 w-4" />
              Run Now
            </>
          )}
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <input
            id="cleanup-enabled"
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleSave({ enabled: e.target.checked })}
            disabled={saving}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-800"
          />
          <Label htmlFor="cleanup-enabled" className="text-neutral-300">
            Enable automatic cleanup (daily at 3:00 AM)
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="keep-images" className="text-neutral-300">
            Images to keep per service
          </Label>
          <Input
            id="keep-images"
            type="number"
            min={1}
            max={10}
            value={settings.keepImages}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val >= 1 && val <= 10) {
                handleSave({ keepImages: val });
              }
            }}
            disabled={saving}
            className="h-10 w-24 border-neutral-800 bg-neutral-900 text-white"
          />
          <p className="text-xs text-neutral-500">
            Older images beyond this limit will be deleted (1-10)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="prune-dangling"
            type="checkbox"
            checked={settings.pruneDangling}
            onChange={(e) => handleSave({ pruneDangling: e.target.checked })}
            disabled={saving}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-800"
          />
          <Label htmlFor="prune-dangling" className="text-neutral-300">
            Prune dangling images
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="prune-networks"
            type="checkbox"
            checked={settings.pruneNetworks}
            onChange={(e) => handleSave({ pruneNetworks: e.target.checked })}
            disabled={saving}
            className="h-4 w-4 rounded border-neutral-700 bg-neutral-800"
          />
          <Label htmlFor="prune-networks" className="text-neutral-300">
            Prune unused networks
          </Label>
        </div>

        {settings.lastResult && (
          <div
            className={`rounded-md p-3 ${
              settings.lastResult.success
                ? "bg-green-900/20 text-green-400"
                : "bg-red-900/20 text-red-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {settings.lastResult.success ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
              <span className="font-medium">
                Last run: {formatDate(settings.lastRun)}
              </span>
            </div>
            <div className="mt-2 text-sm">
              <p>
                Freed: {formatBytes(settings.lastResult.freedBytes)} •{" "}
                {settings.lastResult.deletedImages.length} images •{" "}
                {settings.lastResult.prunedContainers} containers •{" "}
                {settings.lastResult.deletedNetworks.length} networks
              </p>
              {settings.lastResult.errors.length > 0 && (
                <p className="mt-1 text-red-400">
                  {settings.lastResult.errors.length} error(s)
                </p>
              )}
            </div>
          </div>
        )}

        {!settings.lastResult && (
          <p className="text-sm text-neutral-500">
            Last run: {formatDate(settings.lastRun)}
          </p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </SettingCard>
  );
}
