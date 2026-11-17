import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { AppHeader } from "@/components/app/app-header";
import { SettingsClient } from "@/components/settings/settings-client";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Settings · CareerIO" };

export default function SettingsPage() {
  return (
    <PageTransition>
      <Suspense fallback={<div className="h-16 border-b border-line bg-paper" />}>
        <Settings />
      </Suspense>
    </PageTransition>
  );
}

async function Settings() {
  await connection();
  const session = await requireSession("/settings");
  if (!session.onboarded) redirect("/onboarding");
  const { supabase, user, role, fullName } = session;

  const { data: s } = await supabase.from("user_settings").select("email_notifications, job_alerts, discoverable").eq("user_id", user.id).maybeSingle();
  const providers = Array.isArray(user.app_metadata?.providers) ? (user.app_metadata.providers as string[]) : [];

  return (
    <>
      <AppHeader name={fullName} active="settings" role={role} />
      <SettingsClient
        role={role}
        email={user.email ?? ""}
        hasPassword={providers.includes("email")}
        initial={{
          emailNotifications: s?.email_notifications ?? true,
          jobAlerts: (s?.job_alerts ?? "weekly") as "off" | "daily" | "weekly",
          discoverable: s?.discoverable ?? true,
        }}
      />
    </>
  );
}
