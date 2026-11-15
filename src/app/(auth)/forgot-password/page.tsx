import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Reset your password · CareerIO" };

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
