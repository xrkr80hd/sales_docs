"use client";

import { useState } from "react";

type CopyCardLinkButtonProps = {
  label?: string;
  query?: Record<string, string>;
  hash?: string;
  className?: string;
};

export function CopyCardLinkButton({ label = "Copy link", query, hash, className }: CopyCardLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = hash || "";
    Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link:", url.toString());
    }
  }

  return <button type="button" className={className} onClick={copyLink}>{copied ? "Link copied!" : label}</button>;
}
