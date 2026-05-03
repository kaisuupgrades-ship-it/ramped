"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { iconUrl, type Integration } from "@/lib/integrations";

/**
 * Brand logo for an integration. Loads from Simple Icons CDN; falls back to a
 * brand-colored letter chip if the slug 404s or the network fails.
 */
export function BrandLogo({
  integration,
  size = 18,
  className,
}: {
  integration: Integration;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = React.useState(false);

  if (errored) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center font-mono font-bold text-white text-[10px] rounded-[4px]",
          className,
        )}
        style={{ width: size + 4, height: size + 4, background: integration.color }}
        aria-hidden="true"
      >
        {integration.fallback}
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={iconUrl(integration.iconSlug)}
      alt=""
      width={size}
      height={size}
      className={cn("inline-block flex-shrink-0 object-contain", className)}
      onError={() => setErrored(true)}
    />
  );
}
