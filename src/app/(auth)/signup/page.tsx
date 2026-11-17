import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/signup-form";
import { FormSkeleton } from "@/components/auth/form-skeleton";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Create your account · CareerIO" };

export default function SignupPage() {
  return (
    <PageTransition className="">
      <Suspense fallback={<FormSkeleton rows={3} />}>
        <SignupForm />
      </Suspense>
    </PageTransition>
  );
}
