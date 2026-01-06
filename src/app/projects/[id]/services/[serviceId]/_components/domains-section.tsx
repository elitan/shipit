"use client";

import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAddDomain,
  useDeleteDomain,
  useDomains,
  useVerifyDomainDns,
} from "@/hooks/use-domains";
import type { Domain } from "@/lib/api";

interface DomainsSectionProps {
  serviceId: string;
  hasRunningDeployment: boolean;
}

export function DomainsSection({
  serviceId,
  hasRunningDeployment,
}: DomainsSectionProps) {
  const { data: domains, isLoading } = useDomains(serviceId);
  const addMutation = useAddDomain(serviceId);
  const deleteMutation = useDeleteDomain(serviceId);
  const verifyMutation = useVerifyDomainDns(serviceId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [domainType, setDomainType] = useState<"proxy" | "redirect">("proxy");
  const [redirectTarget, setRedirectTarget] = useState("");

  async function handleAddDomain() {
    if (!newDomain) return;

    try {
      await addMutation.mutateAsync({
        domain: newDomain,
        type: domainType,
        redirectTarget: domainType === "redirect" ? redirectTarget : undefined,
      });
      toast.success("Domain added");
      setNewDomain("");
      setRedirectTarget("");
      setDomainType("proxy");
      setShowAddForm(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add domain");
    }
  }

  async function handleVerifyDns(id: string) {
    try {
      const result = await verifyMutation.mutateAsync(id);
      if (result.dnsVerified) {
        toast.success("DNS verified! Domain is now active.");
      } else {
        toast.error(`DNS not configured. Expected: ${result.serverIp}`);
      }
    } catch (err: any) {
      toast.error(err.message || "DNS verification failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this domain?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Domain removed");
    } catch {
      toast.error("Failed to remove domain");
    }
  }

  if (isLoading) {
    return (
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-300">
            Domains
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-neutral-300">
          <span>Domains</span>
          {!showAddForm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasRunningDeployment && domains && domains.length > 0 && (
          <div className="mb-4 rounded-md bg-yellow-900/20 p-3 text-sm text-yellow-400">
            No running deployment. Domains won't work until service is deployed.
          </div>
        )}

        {showAddForm && (
          <div className="mb-4 space-y-4 rounded-md border border-neutral-800 p-4">
            <div className="grid gap-2">
              <Label className="text-sm text-neutral-400">Domain</Label>
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="app.example.com"
                className="h-9 border-neutral-800 bg-neutral-950 text-white placeholder:text-neutral-600"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm text-neutral-400">Type</Label>
              <div className="flex gap-2">
                <Button
                  variant={domainType === "proxy" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDomainType("proxy")}
                  className={
                    domainType === "proxy" ? "" : "border-neutral-700 text-neutral-400"
                  }
                >
                  Proxy
                </Button>
                <Button
                  variant={domainType === "redirect" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDomainType("redirect")}
                  className={
                    domainType === "redirect"
                      ? ""
                      : "border-neutral-700 text-neutral-400"
                  }
                >
                  Redirect
                </Button>
              </div>
            </div>

            {domainType === "redirect" && (
              <div className="grid gap-2">
                <Label className="text-sm text-neutral-400">
                  Redirect to domain
                </Label>
                <Input
                  value={redirectTarget}
                  onChange={(e) => setRedirectTarget(e.target.value)}
                  placeholder="example.com"
                  className="h-9 border-neutral-800 bg-neutral-950 text-white placeholder:text-neutral-600"
                />
                <p className="text-xs text-neutral-500">
                  Visitors will be redirected (301) to this domain
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddDomain}
                disabled={
                  addMutation.isPending ||
                  !newDomain ||
                  (domainType === "redirect" && !redirectTarget)
                }
              >
                {addMutation.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                Add Domain
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setNewDomain("");
                  setRedirectTarget("");
                  setDomainType("proxy");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {domains && domains.length > 0 ? (
          <div className="space-y-2">
            {domains.map((domain) => (
              <DomainRow
                key={domain.id}
                domain={domain}
                onVerify={() => handleVerifyDns(domain.id)}
                onDelete={() => handleDelete(domain.id)}
                isVerifying={verifyMutation.isPending}
              />
            ))}
          </div>
        ) : (
          !showAddForm && (
            <p className="text-sm text-neutral-500">
              No domains configured. Add a domain to access this service via a
              custom URL.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}

interface DomainRowProps {
  domain: Domain;
  onVerify: () => void;
  onDelete: () => void;
  isVerifying: boolean;
}

function DomainRow({ domain, onVerify, onDelete, isVerifying }: DomainRowProps) {
  const isVerified = domain.dns_verified === 1;
  const isActive = domain.ssl_status === "active";

  return (
    <div className="flex items-center justify-between rounded-md border border-neutral-800 p-3">
      <div className="flex items-center gap-3">
        <Globe className="h-4 w-4 text-neutral-500" />
        <div>
          <div className="flex items-center gap-2">
            {domain.type === "redirect" ? (
              <span className="flex items-center gap-1 text-sm text-neutral-300">
                {domain.domain}
                <ArrowRight className="h-3 w-3 text-neutral-500" />
                <span className="text-neutral-400">{domain.redirect_target}</span>
              </span>
            ) : isVerified ? (
              <a
                href={`https://${domain.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
              >
                {domain.domain}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-sm text-neutral-300">{domain.domain}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {isVerified ? (
              <Badge variant="outline" className="border-green-800 text-green-400">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                DNS verified
              </Badge>
            ) : (
              <Badge variant="outline" className="border-yellow-800 text-yellow-400">
                <XCircle className="mr-1 h-3 w-3" />
                DNS pending
              </Badge>
            )}
            {domain.type === "redirect" && (
              <Badge variant="outline" className="border-neutral-700 text-neutral-400">
                301 redirect
              </Badge>
            )}
            {isActive && (
              <Badge variant="outline" className="border-green-800 text-green-400">
                SSL active
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!isVerified && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onVerify}
            disabled={isVerifying}
          >
            {isVerifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Verify DNS"
            )}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-neutral-500" />
        </Button>
      </div>
    </div>
  );
}
