import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { FormSkeleton } from "@/components/auth/form-skeleton";

export const metadata: Metadata = { title: "Log in · CareerIO" };

export default function LoginPage() {
  return (
    <Suspense fallback={<FormSkeleton rows={2} />}>
      <LoginForm />
    </Suspense>
  );
}
