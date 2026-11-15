import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Choose a new password · CareerIO" };

export default function ResetPasswordPage() {
  return <ResetForm />;
}
