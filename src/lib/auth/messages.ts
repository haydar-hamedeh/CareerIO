export function friendlyAuthError(message: string | undefined) {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Try again or reset your password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Log in instead.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute and try again.";
  if (m.includes("should contain") || m.includes("should be at least"))
    return "Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol like ! @ # ?";
  if (m.includes("weak") || m.includes("pwned")) return "This password is too easy to guess. Try a longer one.";
  if (m.includes("provider is not enabled")) return "Google sign-in isn't available right now. Use email instead.";
  if (m.includes("same password") || m.includes("different from the old"))
    return "Choose a password different from your current one.";
  return "Something went wrong on our side. Please try again.";
}
