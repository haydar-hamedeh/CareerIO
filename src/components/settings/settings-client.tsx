"use client";

import { useState, useTransition } from "react";
import { Dialog } from "radix-ui";
import { Bell, KeyRound, Loader2, Mail, ShieldAlert, Trash2, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { changeEmail, changePassword, deleteAccount, saveSettings } from "@/app/settings/actions";
import { Field, MatchHint, PasswordField } from "@/components/auth/fields";

type Initial = { emailNotifications: boolean; jobAlerts: "off" | "daily" | "weekly"; discoverable: boolean };

function Card({ icon, title, hint, children, tone = "default" }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode; tone?: "default" | "danger" }) {
  return (
    <section className={`rounded-[28px] bg-paper p-5 shadow-soft ring-1 sm:p-7 ${tone === "danger" ? "ring-coral/40" : "ring-line"}`}>
      <div className="flex items-start gap-3.5">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tone === "danger" ? "bg-coral/15 text-[#b4391f]" : "bg-mint text-forest"}`}>{icon}</span>
        <div className="min-w-0">
          <h2 className="font-display text-[1.1rem] font-extrabold tracking-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-[13.5px] leading-snug text-muted">{hint}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-forest" : "bg-ink/20"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : ""}`} />
      </button>
    </label>
  );
}

const btn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-forest px-6 text-[14.5px] font-bold text-white transition-colors hover:bg-forest-deep disabled:opacity-60";

export function SettingsClient({ role, email, hasPassword, initial }: { role: "candidate" | "employer"; email: string; hasPassword: boolean; initial: Initial }) {
  const candidate = role === "candidate";
  const [prefs, setPrefs] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, startSave] = useTransition();

  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);
  const savePrefs = () =>
    startSave(async () => {
      const res = await saveSettings(prefs);
      if (res.error) return void toast.error(res.error);
      setSaved(prefs);
      toast.success("Settings saved");
    });

  return (
    <main className="mx-auto max-w-[760px] px-4 py-6 sm:px-6 lg:py-10">
      <h1 className="font-display text-[clamp(1.8rem,3.6vw,2.4rem)] leading-tight font-extrabold tracking-[-0.03em]">Settings</h1>
      <p className="mt-2 text-muted">Your account, notifications and privacy.</p>

      <div className="mt-6 space-y-5">
        <Card icon={<Bell size={19} aria-hidden />} title="Notifications" hint="The bell in the app always works. These control email.">
          <div className="space-y-4">
            <Toggle
              checked={prefs.emailNotifications}
              onChange={(v) => setPrefs((p) => ({ ...p, emailNotifications: v }))}
              label="Email me about activity"
              hint={candidate ? "Interview invites, status changes, new messages and invitations to apply." : "New applicants and new messages."}
            />
            {candidate && (
              <div>
                <p className="text-[14.5px] font-semibold">Job alerts</p>
                <p className="mt-0.5 text-[13px] text-muted">New jobs that fit your profile, picked by the same match score you see in the feed.</p>
                <div role="radiogroup" aria-label="Job alerts" className="mt-3 flex flex-wrap gap-2">
                  {(["off", "daily", "weekly"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={prefs.jobAlerts === v}
                      onClick={() => setPrefs((p) => ({ ...p, jobAlerts: v }))}
                      className={`rounded-full px-4 py-2 text-[13.5px] font-semibold capitalize transition-colors ${prefs.jobAlerts === v ? "bg-forest text-white" : "bg-white text-muted ring-1 ring-line hover:text-ink"}`}
                    >
                      {v === "off" ? "Off" : v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {candidate && (
          <Card icon={<UserSearch size={19} aria-hidden />} title="Privacy" hint="Companies never see your phone number or email until you apply.">
            <Toggle
              checked={prefs.discoverable}
              onChange={(v) => setPrefs((p) => ({ ...p, discoverable: v }))}
              label="Let companies find me"
              hint="Recruiters can find you by skills and role, and invite you to apply. You choose whether to respond."
            />
          </Card>
        )}

        {dirty && (
          <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-full bg-ink px-5 py-3 text-white shadow-lift">
            <span className="text-[14px] font-medium">You have unsaved changes</span>
            <button type="button" onClick={savePrefs} disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-5 text-[13.5px] font-bold text-ink disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" aria-hidden />} Save
            </button>
          </div>
        )}

        <EmailCard email={email} />
        <PasswordCard hasPassword={hasPassword} />
        <DeleteCard role={role} />
      </div>
    </main>
  );
}

function EmailCard({ email }: { email: string }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    start(async () => {
      const res = await changeEmail({ email: value });
      if (res.fieldErrors?.email) return setError(res.fieldErrors.email);
      if (res.error) return setError(res.error);
      setSent(true);
      setValue("");
    });
  };

  return (
    <Card icon={<Mail size={19} aria-hidden />} title="Email" hint={`You sign in with ${email}.`}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="New email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={value} onChange={(e) => setValue(e.target.value)} error={error} />
        {sent && <p className="rounded-2xl bg-mint/60 px-4 py-3 text-[13.5px] leading-snug text-forest-deep">We sent a confirmation link to your new address. The change takes effect once you open it.</p>}
        <button type="submit" disabled={pending || !value} className={btn}>
          {pending && <Loader2 size={15} className="animate-spin" aria-hidden />} Change email
        </button>
      </form>
    </Card>
  );
}

function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    start(async () => {
      const res = await changePassword({ current, password: pw, confirm });
      if (res.fieldErrors) return setErrors(res.fieldErrors);
      if (res.error) return void toast.error(res.error);
      setCurrent("");
      setPw("");
      setConfirm("");
      toast.success("Password updated");
    });
  };

  return (
    <Card icon={<KeyRound size={19} aria-hidden />} title={hasPassword ? "Password" : "Add a password"} hint={hasPassword ? "Use something you don't use anywhere else." : "You signed in with Google. Add a password to also log in with your email."}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {hasPassword && <PasswordField label="Current password" autoComplete="current-password" value={current} onValueChange={setCurrent} error={errors.current} />}
        <PasswordField label="New password" autoComplete="new-password" value={pw} onValueChange={setPw} error={errors.password} showStrength />
        <PasswordField label="Confirm new password" autoComplete="new-password" value={confirm} onValueChange={setConfirm} error={errors.confirm} hint={<MatchHint password={pw} confirm={confirm} />} />
        <button type="submit" disabled={pending || !pw} className={btn}>
          {pending && <Loader2 size={15} className="animate-spin" aria-hidden />} {hasPassword ? "Update password" : "Add password"}
        </button>
      </form>
    </Card>
  );
}

function DeleteCard({ role }: { role: "candidate" | "employer" }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const confirm = () =>
    start(async () => {
      const res = await deleteAccount({ confirm: text });
      // On success the action redirects, so we only get here when it failed.
      setError(res.fieldErrors?.confirm ?? res.error);
    });

  return (
    <Card
      tone="danger"
      icon={<ShieldAlert size={19} aria-hidden />}
      title="Delete account"
      hint={role === "employer" ? "Removes your company, all your jobs, every applicant's application and your messages. This cannot be undone." : "Removes your profile, CVs, applications and messages. This cannot be undone."}
    >
      <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setText(""); setError(undefined); } }}>
        <Dialog.Trigger className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[14.5px] font-bold text-[#b4391f] ring-1 ring-coral/50 transition-colors hover:bg-coral/10">
          <Trash2 size={16} aria-hidden /> Delete my account
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm data-[state=open]:animate-[fade-in_0.2s_ease-out]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-paper p-6 shadow-lift ring-1 ring-line outline-none sm:p-7">
            <Dialog.Title className="font-display text-[1.25rem] font-extrabold tracking-tight">Delete your account?</Dialog.Title>
            <Dialog.Description className="mt-2 text-[14px] leading-snug text-muted">
              Everything is deleted right away and cannot be recovered. Type <span className="font-bold text-ink">DELETE</span> to confirm.
            </Dialog.Description>
            <div className="mt-5">
              <Field label="Confirmation" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" placeholder="DELETE" error={error} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close className="h-11 rounded-full px-5 text-[14px] font-semibold text-muted hover:bg-ink/5">Cancel</Dialog.Close>
              <button
                type="button"
                onClick={confirm}
                disabled={pending || text !== "DELETE"}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#b4391f] px-6 text-[14px] font-bold text-white transition-opacity disabled:opacity-50"
              >
                {pending && <Loader2 size={14} className="animate-spin" aria-hidden />} Delete forever
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Card>
  );
}
