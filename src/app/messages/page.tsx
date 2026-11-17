import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { loadConversations } from "@/lib/messages/load";
import { AppHeader } from "@/components/app/app-header";
import { MessagesClient } from "@/components/messages/messages-client";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Messages · CareerIO" };

type Search = { c?: string };

export default function MessagesPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <PageTransition>
      <Suspense fallback={<MessagesSkeleton />}>
        <Messages searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

async function Messages({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const sp = await searchParams;
  const session = await requireSession(`/messages${sp.c ? `?c=${encodeURIComponent(sp.c)}` : ""}`);
  if (!session.onboarded) redirect("/onboarding");
  const { supabase, user, role, fullName } = session;
  const conversations = await loadConversations(supabase, user.id, role);

  return (
    <>
      <AppHeader name={fullName} active="messages" role={role} />
      <main className="mx-auto max-w-[1100px] px-0 sm:px-6 sm:py-6">
        <MessagesClient
          userId={user.id}
          role={role}
          initialConversations={conversations}
          initialActive={sp.c && conversations.some((c) => c.id === sp.c) ? sp.c : null}
        />
      </main>
    </>
  );
}

function MessagesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading messages" className="animate-pulse">
      <div className="h-16 border-b border-line bg-paper" />
      <div className="mx-auto h-[70dvh] max-w-[1100px] px-6 py-6">
        <div className="h-full rounded-[28px] bg-ink/6" />
      </div>
    </div>
  );
}
