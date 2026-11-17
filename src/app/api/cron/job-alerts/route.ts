import { NextResponse, type NextRequest } from "next/server";
import { hasAdmin } from "@/lib/supabase/admin";
import { runJobAlerts } from "@/lib/jobs/alerts";

export const maxDuration = 120;

/** Called once a day by Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAdmin()) return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
  return NextResponse.json(await runJobAlerts());
}
