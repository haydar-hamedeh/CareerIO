"use client";

import { useState, useTransition } from "react";
import { Dialog, DropdownMenu } from "radix-ui";
import { Ban, CheckCircle2, Flag, Loader2, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { blockConversation, reportConversation, unblockConversation, type BlockState } from "@/app/messages/actions";

const reasons = [
  { value: "spam", label: "Spam or unwanted promotion" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "scam", label: "Scam or fraud" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
] as const;

type Reason = (typeof reasons)[number]["value"];

const item = "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-medium outline-none data-[highlighted]:bg-ink/5";

/** The ⋯ menu in a chat header: report the conversation, or block / unblock the other person. */
export function ChatMenu({ conversationId, name, blocked, onBlockChange }: { conversationId: string; name: string; blocked: BlockState; onBlockChange: (b: BlockState) => void }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("spam");
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();

  const sendReport = () =>
    start(async () => {
      const res = await reportConversation({ conversationId, reason, details });
      if (res.error) return void toast.error(res.error);
      setReportOpen(false);
      setDetails("");
      toast.success("Report sent. Thank you, we'll review it.");
    });

  const block = () =>
    start(async () => {
      const res = await blockConversation(conversationId);
      if (res.error) return void toast.error(res.error);
      onBlockChange("me");
      setBlockOpen(false);
      toast.success(`${name} can no longer message you here.`);
    });

  const unblock = () =>
    start(async () => {
      const res = await unblockConversation(conversationId);
      if (res.error) return void toast.error(res.error);
      onBlockChange(null);
      toast.success("Unblocked");
    });

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger aria-label="Conversation options" className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-forest">
          <MoreVertical size={18} aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="z-50 w-56 rounded-2xl bg-paper p-1.5 shadow-lift ring-1 ring-line">
            <DropdownMenu.Item className={item} onSelect={() => setReportOpen(true)}>
              <Flag size={16} aria-hidden /> Report conversation
            </DropdownMenu.Item>
            {blocked === "me" ? (
              <DropdownMenu.Item className={item} onSelect={unblock}>
                <CheckCircle2 size={16} aria-hidden /> Unblock {name}
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item className={`${item} text-[#b4391f]`} onSelect={() => setBlockOpen(true)}>
                <Ban size={16} aria-hidden /> Block {name}
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog.Root open={reportOpen} onOpenChange={setReportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-paper p-6 shadow-lift ring-1 ring-line outline-none sm:p-7">
            <Dialog.Title className="font-display text-[1.25rem] font-extrabold tracking-tight">Report this conversation</Dialog.Title>
            <Dialog.Description className="mt-1.5 text-[14px] leading-snug text-muted">Tell us what&apos;s wrong. The other person won&apos;t know you reported them.</Dialog.Description>
            <div role="radiogroup" aria-label="Reason" className="mt-4 space-y-1.5">
              {reasons.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={reason === r.value}
                  onClick={() => setReason(r.value)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[14px] font-medium ring-1 transition-colors ${reason === r.value ? "bg-mint/60 ring-forest" : "bg-white ring-line hover:ring-ink/25"}`}
                >
                  <span className={`grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full ring-2 ${reason === r.value ? "ring-forest" : "ring-ink/25"}`}>
                    {reason === r.value && <span className="h-2 w-2 rounded-full bg-forest" />}
                  </span>
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Add details (optional)"
              aria-label="Details"
              className="mt-3 w-full resize-none rounded-2xl bg-white px-4 py-3 text-[14px] ring-1 ring-line outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-forest"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Dialog.Close className="h-11 rounded-full px-5 text-[14px] font-semibold text-muted hover:bg-ink/5">Cancel</Dialog.Close>
              <button type="button" onClick={sendReport} disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-6 text-[14px] font-bold text-white hover:bg-forest-deep disabled:opacity-60">
                {pending && <Loader2 size={14} className="animate-spin" aria-hidden />} Send report
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={blockOpen} onOpenChange={setBlockOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-paper p-6 shadow-lift ring-1 ring-line outline-none sm:p-7">
            <Dialog.Title className="font-display text-[1.25rem] font-extrabold tracking-tight">Block {name}?</Dialog.Title>
            <Dialog.Description className="mt-2 text-[14px] leading-snug text-muted">They won&apos;t be able to send you messages in this conversation. You can unblock them any time.</Dialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close className="h-11 rounded-full px-5 text-[14px] font-semibold text-muted hover:bg-ink/5">Cancel</Dialog.Close>
              <button type="button" onClick={block} disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#b4391f] px-6 text-[14px] font-bold text-white disabled:opacity-60">
                {pending && <Loader2 size={14} className="animate-spin" aria-hidden />} Block
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
