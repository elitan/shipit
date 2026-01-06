"use client";

import { ExternalLink } from "lucide-react";

interface SettingCardProps {
  title: string;
  description: string;
  learnMoreUrl?: string;
  learnMoreText?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SettingCard({
  title,
  description,
  learnMoreUrl,
  learnMoreText,
  children,
  footer,
}: SettingCardProps) {
  return (
    <div className="rounded-lg border border-neutral-800">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm text-neutral-400">{description}</p>
        <div className="mt-6">{children}</div>
      </div>
      {(learnMoreUrl || footer) && (
        <div className="flex items-center justify-between border-t border-neutral-800 px-6 py-3">
          {learnMoreUrl ? (
            <a
              href={learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300"
            >
              {learnMoreText || "Learn more"}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <div />
          )}
          {footer}
        </div>
      )}
    </div>
  );
}
