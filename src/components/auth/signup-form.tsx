"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import { signUp, type FormState } from "@/app/(auth)/actions";
import { parseRole, type Role } from "@/lib/auth/schemas";
import { ease } from "@/lib/site";
import { Divider, Field, FormAlert, MatchHint, PasswordField, SubmitButton } from "./fields";
import { GoogleButton } from "./google-button";
import { RolePicker } from "./role-picker";

export function SignupForm() {
  const params = useSearchParams();
  const [state, action] = useActionState<FormState, FormData>(signUp, {});
  const [role, setRole] = useState<Role>(parseRole(params.get("role")) ?? "candidate");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [dismissed, setDismissed] = useState<FormState | null>(null);
  const fe = state.fieldErrors;
  const done = state.success && dismissed !== state;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {done ? (
        <motion.div
          key="sent"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.5, ease }}
          className="text-center"
        >
          <motion.span
            initial={{ scale: 0.4, rotate: -16 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 13, delay: 0.1 }}
            className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-mint text-forest"
          >
            <MailCheck size={28} aria-hidden />
          </motion.span>
          <h1 className="mt-6 font-display text-[2rem] leading-tight font-extrabold tracking-[-0.03em]">
            Check your inbox
          </h1>
          <p className="mx-auto mt-3 max-w-sm leading-relaxed text-muted">
            We sent a confirmation link to <span className="font-semibold text-ink">{state.email}</span>. Open it to
            activate your account.
          </p>
          <p className="mt-6 rounded-2xl bg-white px-4 py-3 text-[13.5px] text-muted ring-1 ring-line">
            Nothing yet? Check your spam folder, or wait a minute and try again.
          </p>
          <button
            type="button"
            onClick={() => setDismissed(state)}
            className="mt-6 text-[14px] font-semibold text-forest underline-offset-4 hover:underline"
          >
            Use a different email
          </button>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.5, ease }}
        >
          <h1 className="font-display text-[2rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2.25rem]">
            Create your account
          </h1>
          <p className="mt-2 text-muted">
            Already have one?{" "}
            <Link href="/login" className="font-semibold text-forest underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>

          <div className="mt-8">
            <RolePicker value={role} onChange={setRole} />
          </div>

          <div className="mt-6">
            <GoogleButton label="Sign up with Google" role={role} from="signup" />
          </div>

          <Divider>or with email</Divider>

          <FormAlert message={params.get("error") ?? state.error} />

          <form action={action} noValidate className="space-y-5">
            <input type="hidden" name="role" value={role} />
            <Field
              label="Full name"
              name="fullName"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fe?.fullName?.[0]}
            />
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fe?.email?.[0]}
            />
            <PasswordField
              label="Password"
              name="password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={password}
              onValueChange={setPassword}
              error={fe?.password?.[0]}
              showStrength
            />
            <PasswordField
              label="Confirm password"
              name="confirm"
              autoComplete="new-password"
              placeholder="Type it again"
              value={confirm}
              onValueChange={setConfirm}
              error={fe?.confirm?.[0]}
              hint={<MatchHint password={password} confirm={confirm} />}
            />
            <div className="pt-1">
              <SubmitButton pendingText="Creating your account…">
                {role === "employer" ? "Create employer account" : "Create account"}
              </SubmitButton>
            </div>
          </form>

          <p className="mt-6 text-center text-[12.5px] leading-relaxed text-muted">
            By creating an account you agree to how we handle your data: private CV storage, and you can delete
            everything anytime.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
