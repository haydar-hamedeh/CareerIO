import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { FormSkeleton } from "@/components/auth/form-skeleton";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Log in · CareerIO" };

export default function LoginPage() {
  return (
    <PageTransition className="">
      <Suspense fallback={<FormSkeleton rows={2} />}>
        <LoginForm />
      </Suspense>
    </PageTransition>
  );
}
