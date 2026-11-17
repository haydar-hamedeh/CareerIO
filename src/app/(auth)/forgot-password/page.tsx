import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/password-forms";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = { title: "Reset your password · CareerIO" };

export default function ForgotPasswordPage() {
  return (
    <PageTransition className="">
      <ForgotForm />
    </PageTransition>
  );
}
