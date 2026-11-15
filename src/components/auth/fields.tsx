"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, CheckCircle2, Eye, EyeOff, Loader2, X } from "lucide-react";
import { useFormStatus } from "react-dom";
import { ease } from "@/lib/site";
import { passwordRules, passwordStrength } from "@/lib/auth/password-rules";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  trailing?: React.ReactNode;
  labelAside?: React.ReactNode;
};

export function Field({ label, error, hint, trailing, labelAside, className = "", ...input }: FieldProps) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[14px] font-semibold text-ink">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errId : undefined}
          className={`h-12 w-full rounded-2xl bg-white px-4 text-[15px] text-ink ring-1 transition-[box-shadow,background-color] duration-200 outline-none placeholder:text-ink/35 focus:ring-2 ${
            error ? "ring-coral focus:ring-coral" : "ring-line hover:ring-ink/25 focus:ring-forest"
          } ${trailing ? "pr-12" : ""}`}
          {...input}
        />
        {trailing && <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errId}
            role="alert"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease }}
            className="flex items-center gap-1.5 overflow-hidden pt-2 text-[13px] font-medium text-[#c2410c]"
          >
            <AlertCircle size={14} aria-hidden className="shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      {hint}
    </div>
  );
}

export function PasswordField({
  showStrength = false,
  value,
  onValueChange,
  hint,
  ...props
}: Omit<FieldProps, "type" | "trailing" | "value"> & {
  showStrength?: boolean;
  value: string;
  onValueChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="grid h-9 w-9 place-items-center rounded-xl text-muted transition-colors hover:bg-sand hover:text-ink"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={visible ? "hide" : "show"}
              initial={{ opacity: 0, scale: 0.6, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.6, rotate: 20 }}
              transition={{ duration: 0.15 }}
            >
              {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </motion.span>
          </AnimatePresence>
        </button>
      }
      hint={showStrength ? <StrengthMeter value={value} /> : hint}
    />
  );
}

const levels = [
  { label: "", bar: "bg-ink/10", pill: "bg-ink/5 text-muted" },
  { label: "Weak", bar: "bg-coral", pill: "bg-coral/12 text-[#c2410c]" },
  { label: "Fair", bar: "bg-sun", pill: "bg-sun/30 text-[#8a5a00]" },
  { label: "Good", bar: "bg-forest", pill: "bg-mint text-forest-deep" },
  { label: "Strong", bar: "bg-forest-deep", pill: "bg-forest text-white" },
] as const;

function StrengthMeter({ value }: { value: string }) {
  const { score } = passwordStrength(value);
  const level = levels[score];

  return (
    <div className="pt-3">
      <div className="mb-2 flex h-6 items-center justify-between">
        <span className="text-[12.5px] font-semibold text-muted">Password strength</span>
        <AnimatePresence mode="wait" initial={false}>
          {score > 0 && (
            <motion.span
              key={level.label}
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${level.pill}`}
              aria-live="polite"
            >
              {level.label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-2 overflow-hidden rounded-full bg-ink/[0.07]">
            <motion.div
              className={`h-full w-full origin-left rounded-full transition-colors duration-300 ${level.bar}`}
              initial={false}
              animate={{ scaleX: score >= i ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26, delay: score >= i ? (i - 1) * 0.05 : 0 }}
            />
          </div>
        ))}
      </div>

      <ul className="mt-3.5 grid grid-cols-1 gap-x-4 gap-y-2 min-[400px]:grid-cols-2">
        {passwordRules.map((rule) => {
          const met = rule.test(value);
          return (
            <li key={rule.id} className="flex items-center gap-2 text-[12.5px]">
              <span
                className={`relative grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                  met ? "bg-forest" : "ring-1 ring-ink/20 ring-inset"
                }`}
              >
                <AnimatePresence initial={false}>
                  {met && (
                    <motion.span
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="absolute inset-0 grid place-items-center text-white"
                    >
                      <Check size={11} strokeWidth={3.5} aria-hidden />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={`transition-colors duration-300 ${met ? "font-medium text-forest-deep" : "text-muted"}`}>
                {rule.label}
                <span className="sr-only">{met ? " (done)" : " (missing)"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MatchHint({ password, confirm }: { password: string; confirm: string }) {
  const matches = confirm.length > 0 && password === confirm;
  return (
    <div className="h-7 pt-2" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {confirm.length > 0 && (
          <motion.p
            key={matches ? "yes" : "no"}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2, ease }}
            className={`flex items-center gap-1.5 text-[12.5px] font-medium ${matches ? "text-forest-deep" : "text-muted"}`}
          >
            {matches ? <CheckCircle2 size={14} aria-hidden /> : <X size={14} aria-hidden />}
            {matches ? "Passwords match" : "Passwords don't match yet"}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}


export function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-forest font-display text-[15px] font-bold text-white shadow-soft transition-[background-color,transform] duration-300 ease-(--ease-out-soft) hover:bg-forest-deep active:scale-[0.98] disabled:cursor-wait disabled:opacity-85"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={pending ? "p" : "i"}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.2, ease }}
          className="inline-flex items-center gap-2"
        >
          {pending && <Loader2 size={17} className="animate-spin" aria-hidden />}
          {pending ? pendingText : children}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export function FormAlert({ message, tone = "error" }: { message?: string; tone?: "error" | "success" }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          role={tone === "error" ? "alert" : "status"}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease }}
          className="overflow-hidden"
        >
          <div
            className={`mb-5 flex gap-2.5 rounded-2xl px-4 py-3 text-[14px] leading-snug font-medium ${
              tone === "error" ? "bg-coral/10 text-[#9a3412]" : "bg-mint text-forest-deep"
            }`}
          >
            {tone === "error" ? (
              <AlertCircle size={17} className="mt-px shrink-0" aria-hidden />
            ) : (
              <CheckCircle2 size={17} className="mt-px shrink-0" aria-hidden />
            )}
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-4 text-[13px] text-muted">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
