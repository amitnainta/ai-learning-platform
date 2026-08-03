"use client";

import { useEffect, useRef } from "react";

/**
 * Automatic "in progress" tracking, decision #4
 * (factory/work/progress-tracking/PLAN.md): fires exactly one
 * `POST /api/progress` with `{ action: "view" }` in a mount effect. This is
 * a client beacon, never a write during server render, for a specific,
 * checkable reason: `/lessons/[slug]` is `export const dynamic =
 * "force-dynamic"`, and Next.js's `<Link>` prefetches the RSC payload for
 * dynamic routes on hover/viewport entry in production. Every lesson title
 * on a path page is a `<Link>` — a server-render write would mark items
 * "in progress" that a learner merely scrolled past, corrupting the data
 * FR-PROG-003's percentages and FR-PROG-002's resume target are computed
 * from. Renders nothing; swallows every error (a failed beacon must never
 * surface as an error to a learner reading a lesson).
 */
export function ViewTracker({ contentItemSlug }: { contentItemSlug: string }) {
  const firedRef = useRef(false);

  useEffect(() => {
    // Guards against React strict-mode's development double-invocation of
    // effects, which would otherwise send two `view` beacons per real
    // mount.
    if (firedRef.current) {
      return;
    }
    firedRef.current = true;

    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentItemSlug, action: "view" }),
    }).catch(() => {
      // Deliberately swallowed — see the module comment.
    });
  }, [contentItemSlug]);

  return null;
}
