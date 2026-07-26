import { NextResponse } from "next/server";

// Target of the external uptime monitor (NFR-AVAIL-001) and the CI/deploy
// smoke check (NFR-OBS-001). Kept dependency-free (no DB ping) during
// scaffolding so it works before Neon is provisioned and so an outage of a
// downstream dependency doesn't false-positive an app-tier outage; a
// DB-connectivity check can be layered on once the product schema exists,
// exposed as a separate field rather than failing this endpoint outright.
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
