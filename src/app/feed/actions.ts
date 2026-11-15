"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const jobId = z.uuid();

export async function setJobSaved(id: string, saved: boolean): Promise<{ ok: boolean }> {
  if (!jobId.safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false };

  const { error } = saved
    ? await supabase.from("saved_jobs").upsert({ user_id: data.user.id, job_id: id }, { onConflict: "user_id,job_id", ignoreDuplicates: true })
    : await supabase.from("saved_jobs").delete().eq("user_id", data.user.id).eq("job_id", id);

  return { ok: !error };
}
