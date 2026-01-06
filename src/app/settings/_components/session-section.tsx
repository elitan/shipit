"use client";

import { Button } from "@/components/ui/button";
import { SettingCard } from "./setting-card";

export function SessionSection() {
  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <SettingCard title="Session" description="Manage your current session.">
      <Button variant="outline" onClick={handleSignOut}>
        Sign out
      </Button>
    </SettingCard>
  );
}
