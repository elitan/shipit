"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function SettingsLink() {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    fetch("/api/updates")
      .then((res) => res.json())
      .then((data) => {
        setHasUpdate(!!data.availableVersion);
      })
      .catch(() => {});
  }, []);

  return (
    <Link
      href="/settings"
      className="relative text-neutral-400 transition-colors hover:text-neutral-100"
      title="Settings"
    >
      <Settings className="h-5 w-5" />
      {hasUpdate && (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
      )}
    </Link>
  );
}
