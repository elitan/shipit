"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { BreadcrumbHeader } from "@/components/breadcrumb-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface DnsStatus {
  valid: boolean;
  serverIp: string;
  domainIp: string | null;
}

export default function SettingsPage() {
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [dnsStatus, setDnsStatus] = useState<DnsStatus | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [currentDomain, setCurrentDomain] = useState<string | null>(null);
  const [sslStatus, setSslStatus] = useState<"true" | "pending" | "false">(
    "false",
  );
  const [pollingTimedOut, setPollingTimedOut] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.domain) {
          setCurrentDomain(data.domain);
          setDomain(data.domain);
        }
        if (data.email) {
          setEmail(data.email);
        }
        if (data.ssl_enabled === "true" || data.ssl_enabled === "pending") {
          setSslStatus(data.ssl_enabled);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sslStatus !== "pending" || !currentDomain) return;

    const startTime = Date.now();
    const maxDuration = 60000;

    const interval = setInterval(async () => {
      if (Date.now() - startTime > maxDuration) {
        clearInterval(interval);
        setPollingTimedOut(true);
        setEnabling(false);
        return;
      }

      try {
        const res = await fetch("/api/settings/verify-ssl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: currentDomain }),
        });
        const data = await res.json();
        if (data.working) {
          clearInterval(interval);
          setSslStatus("true");
          setSuccess(true);
          setEnabling(false);
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [sslStatus, currentDomain]);

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

  async function handleEnableSsl() {
    if (!domain || !email || !dnsStatus?.valid) return;

    setEnabling(true);
    setError("");
    setPollingTimedOut(false);

    try {
      const res = await fetch("/api/settings/enable-ssl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to enable SSL");
        setEnabling(false);
        return;
      }

      setCurrentDomain(domain);
      setSslStatus("pending");
    } catch {
      setError("Failed to enable SSL");
      setEnabling(false);
    }
  }

  return (
    <>
      <BreadcrumbHeader items={[{ label: "Settings" }]} />
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-lg">
          <Card className="border-neutral-800 bg-neutral-900">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-neutral-100">
                Domain & SSL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {sslStatus === "true" && currentDomain && (
                <div className="flex items-center gap-2 rounded-md bg-green-900/20 p-3 text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>
                    SSL enabled for{" "}
                    <a
                      href={`https://${currentDomain}`}
                      className="underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {currentDomain}
                    </a>
                  </span>
                </div>
              )}

              {sslStatus === "pending" && currentDomain && !pollingTimedOut && (
                <div className="flex items-center gap-2 rounded-md bg-blue-900/20 p-3 text-blue-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Configuring SSL... This may take up to 60 seconds.</span>
                </div>
              )}

              {sslStatus === "pending" && pollingTimedOut && (
                <div className="flex items-center gap-2 rounded-md bg-yellow-900/20 p-3 text-yellow-400">
                  <span>
                    SSL is still being configured. Please wait a few minutes and
                    refresh the page.
                  </span>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="domain" className="text-neutral-300">
                    Domain
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="domain"
                      value={domain}
                      onChange={(e) => {
                        setDomain(e.target.value);
                        setDnsStatus(null);
                      }}
                      placeholder="frost.example.com"
                      className="border-neutral-700 bg-neutral-800 text-neutral-100 placeholder:text-neutral-500"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleVerifyDns}
                      disabled={!domain || verifying}
                    >
                      {verifying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  </div>
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
              </div>

              <Separator className="bg-neutral-800" />

              <div className="grid gap-2">
                <Label htmlFor="email" className="text-neutral-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="border-neutral-700 bg-neutral-800 text-neutral-100 placeholder:text-neutral-500"
                />
                <p className="text-xs text-neutral-500">
                  Used for Let's Encrypt SSL certificates
                </p>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              {success && (
                <div className="rounded-md bg-green-900/20 p-3 text-green-400">
                  <p className="font-medium">SSL enabled successfully!</p>
                  <p className="mt-1 text-sm">
                    Your site is now available at{" "}
                    <a
                      href={`https://${domain}`}
                      className="underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      https://{domain}
                    </a>
                  </p>
                </div>
              )}

              <Button
                onClick={handleEnableSsl}
                disabled={
                  !domain ||
                  !email ||
                  !dnsStatus?.valid ||
                  enabling ||
                  sslStatus === "pending"
                }
                className="w-full"
              >
                {enabling || sslStatus === "pending" ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Configuring SSL...
                  </>
                ) : (
                  "Enable SSL"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
