"use client";

import { useEffect } from "react";
import { recordJobView } from "@/app/jobs/actions";

/** Records that this person looked at the job. Runs in the browser, so link prefetching and crawlers are never counted. */
export function ViewTracker({ jobId }: { jobId: string }) {
  useEffect(() => {
    const key = `viewed:${jobId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage can be blocked; the database still counts each person once.
    }
    void recordJobView(jobId).catch(() => {});
  }, [jobId]);
  return null;
}
