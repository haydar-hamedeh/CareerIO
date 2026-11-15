"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      offset={20}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "!rounded-2xl !border-0 !bg-paper !text-ink !shadow-lift !ring-1 !ring-[var(--line)] !font-sans !text-[14px] !font-medium",
          description: "!text-muted",
          success: "[&_[data-icon]]:!text-forest",
          error: "!bg-[#fff1ec] !text-[#9a3412]",
        },
      }}
    />
  );
}
