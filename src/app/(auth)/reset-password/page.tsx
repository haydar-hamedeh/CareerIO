import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/password-forms";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Choose a new password · CareerIO" };

export default function ResetPasswordPage() {
  return (
    <PageTransition className="">
      <ResetForm />
    </PageTransition>
  );
}
