"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type FormState } from "@/app/(auth)/actions";
import { safeNext } from "@/lib/auth/schemas";
import { Divider, Field, FormAlert, PasswordField, SubmitButton } from "./fields";
import { GoogleButton } from "./google-button";

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [state, action] = useActionState<FormState, FormData>(signIn, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const fe = state.fieldErrors;

  return (
    <div>
      <h1 className="font-display text-[2rem] leading-tight font-extrabold tracking-[-0.03em] sm:text-[2.25rem]">
        Welcome back
      </h1>
      <p className="mt-2 text-muted">
        New to CareerIO?{" "}
        <Link href="/signup" className="font-semibold text-forest underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-8">
        <GoogleButton label="Continue with Google" next={next} from="login" />
      </div>

      <Divider>or with email</Divider>

      <FormAlert message={state.error ?? params.get("error") ?? undefined} />

      <form action={action} noValidate className="space-y-5">
        <input type="hidden" name="next" value={next} />
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
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onValueChange={setPassword}
          error={fe?.password?.[0]}
          labelAside={
            <Link href="/forgot-password" className="text-[13px] font-semibold text-forest underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          }
        />
        <div className="pt-1">
          <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
        </div>
      </form>
    </div>
  );
}
