"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { startConversation } from "@/app/messages/actions";

/** Round icon-only version for dense lists. */
export function MessageIconButton({ applicationId, name }: { applicationId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const open = () =>
    start(async () => {
      const res = await startConversation(applicationId);
      if (res.id) router.push(`/messages?c=${res.id}`);
      else toast.error(res.error ?? "We couldn't open the conversation.");
    });

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      aria-label={`Message ${name}`}
      title={`Message ${name}`}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-forest ring-1 ring-line transition-[background-color,box-shadow,transform] hover:bg-mint hover:ring-forest/30 active:scale-90 disabled:opacity-60"
    >
      {pending ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <MessageSquare size={17} aria-hidden />}
    </button>
  );
}

/** Opens the chat for an application (creating it the first time) and goes there. */
export function MessageButton({ applicationId, label = "Message", className = "" }: { applicationId: string; label?: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const open = () =>
    start(async () => {
      const res = await startConversation(applicationId);
      if (res.id) router.push(`/messages?c=${res.id}`);
      else toast.error(res.error ?? "We couldn't open the conversation.");
    });

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className={`inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-semibold ring-1 ring-line transition-colors hover:bg-mint/50 hover:ring-forest/30 disabled:opacity-60 ${className}`}
    >
      {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <MessageSquare size={15} className="text-forest" aria-hidden />}
      {label}
    </button>
  );
}
