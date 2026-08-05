"use client";

import type { ReactNode } from "react";

/**
 * Decision #4's curated-item counterpart to `<ViewTracker>` (task 14): the
 * platform cannot observe a page render for a curated item (there is no
 * detail page — decision #10, `learning-paths-content`), so "in progress"
 * is recorded on the outbound click instead. Fires the same `view` beacon
 * with `fetch(..., { keepalive: true })` so the request survives the
 * navigation the click triggers, and deliberately never calls
 * `preventDefault` — navigation to the external resource must never be
 * blocked or delayed by this. Wraps `<ExternalLink>` rather than modifying
 * it, so that component stays a pure server component with no progress
 * knowledge.
 */
export function CuratedOpenTracker({
  contentItemSlug,
  children,
}: {
  contentItemSlug: string;
  children: ReactNode;
}) {
  function handleClick() {
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentItemSlug, action: "view" }),
      keepalive: true,
    }).catch(() => {
      // Deliberately swallowed — see <ViewTracker> for the same rationale.
    });
  }

  return (
    <span onClick={handleClick} onAuxClick={handleClick}>
      {children}
    </span>
  );
}
