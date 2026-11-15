"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, MailCheck } from "lucide-react";
import { requestPasswordReset, updatePassword, type FormState } from "@/app/(auth)/actions";
import { ease } from "@/lib/site";
import { Field, FormAlert, MatchHint, PasswordField, SubmitButton } from "./fields";

export function ForgotForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  const [email, setEmail] = useState("");

  return (
    <AnimatePresence mode="wait" initial={false}>
      {state.success ? (
        <motion.div
          key="sent"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
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
            If an account exists for <span className="font-semibold text-ink">{state.email}</span>, a reset link is on
            its way.
          </p>
          <BackToLogin />
        </motion.div>
      ) : (
        <motion.div key="form" exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3, ease }}>
          <h1 className="font-display text-[2rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2.25rem]">
            Reset your password
          </h1>
          <p className="mt-2 leading-relaxed text-muted">
            Enter the email you signed up with and we&apos;ll send you a link to choose a new password.
          </p>
          <div className="mt-8">
            <FormAlert message={state.error} />
            <form action={action} noValidate className="space-y-5">
              <Field
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={state.fieldErrors?.email?.[0]}
              />
              <SubmitButton pendingText="Sending link…">Send reset link</SubmitButton>
            </form>
          </div>
          <BackToLogin />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ResetForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <div>
      <h1 className="font-display text-[2rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2.25rem]">
        Choose a new password
      </h1>
      <p className="mt-2 text-muted">Make it something you haven&apos;t used here before.</p>
      <div className="mt-8">
        <FormAlert message={state.error} />
        <form action={action} noValidate className="space-y-5">
          <PasswordField
            label="New password"
            name="password"
            autoComplete="new-password"
            value={password}
            onValueChange={setPassword}
            error={state.fieldErrors?.password?.[0]}
            showStrength
          />
          <PasswordField
            label="Confirm password"
            name="confirm"
            autoComplete="new-password"
            value={confirm}
            onValueChange={setConfirm}
            error={state.fieldErrors?.confirm?.[0]}
            hint={<MatchHint password={password} confirm={confirm} />}
          />
          <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
        </form>
      </div>
      <BackToLogin />
    </div>
  );
}

function BackToLogin() {
  return (
    <Link
      href="/login"
      className="group mt-8 inline-flex items-center gap-2 text-[14px] font-semibold text-forest"
    >
      <ArrowLeft size={16} className="transition-transform duration-300 group-hover:-translate-x-1" aria-hidden />
      Back to log in
    </Link>
  );
}
