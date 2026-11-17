"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setJobStatus } from "@/app/recruiter/actions";

export function JobStatusButton({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const open = status === "open";

  const toggle = () =>
    start(async () => {
      const res = await setJobStatus(jobId, open ? "closed" : "open");
      if (res.error) return void toast.error(res.error);
      toast.success(open ? "Job closed. It no longer takes applications." : "Job is live");
      router.refresh();
    });

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-muted ring-1 ring-line transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-60"
    >
      {pending && <Loader2 size={13} className="animate-spin" aria-hidden />}
      {open ? "Close job" : status === "draft" ? "Publish" : "Reopen"}
    </button>
  );
}
