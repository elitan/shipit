"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingCard } from "./setting-card";

interface DnsStatus {
  valid: boolean;
  serverIp: string;
  domainIp: string | null;
}

export function DomainSection() {
  const [domain, setDomain] = useState("");
  const [dnsStatus, setDnsStatus] = useState<DnsStatus | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.domain) {
          setDomain(data.domain);
        }
      })
      .catch(() => {});
  }, []);

  async function handleVerifyDns() {
    if (!domain) return;

    setVerifying(true);
    setError("");
    setDnsStatus(null);

    try {
      const res = await fetch("/api/settings/verify-dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "DNS verification failed");
        return;
      }

      setDnsStatus(data);
    } catch {
      setError("Failed to verify DNS");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <SettingCard
      title="Domain"
      description="Configure the domain for your Frost instance. Point your domain's DNS A record to this server's IP address."
      learnMoreUrl="https://letsencrypt.org/docs/challenge-types/"
      learnMoreText="Learn more about DNS"
      footer={
        <Button
          variant="secondary"
          onClick={handleVerifyDns}
          disabled={!domain || verifying}
        >
          {verifying ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify DNS"
          )}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="domain" className="text-sm text-neutral-400">
            Domain
          </Label>
          <Input
            id="domain"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
              setDnsStatus(null);
            }}
            placeholder="frost.example.com"
            className="h-10 border-neutral-800 bg-neutral-900 text-white placeholder:text-neutral-600 focus-visible:ring-neutral-700"
          />
        </div>

        {dnsStatus && (
          <div
            className={`flex items-start gap-2 rounded-md p-3 ${
              dnsStatus.valid
                ? "bg-green-900/20 text-green-400"
                : "bg-red-900/20 text-red-400"
            }`}
          >
            {dnsStatus.valid ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="text-sm">
              {dnsStatus.valid ? (
                <span>DNS configured correctly</span>
              ) : (
                <span>
                  Domain points to {dnsStatus.domainIp || "nothing"}.
                  <br />
                  Expected: {dnsStatus.serverIp}
                </span>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </SettingCard>
  );
}
