import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseRole, safeNext } from "@/lib/auth/schemas";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const role = parseRole(searchParams.get("role"));

  const fail = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  if (searchParams.get("error")) return fail("Sign-in was cancelled or failed. Please try again.");
  if (!code) return fail("That link is invalid or has expired. Please try again.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail("That link is invalid or has expired. Please try again.");

  const meta = data.user.user_metadata ?? {};
  if (!parseRole(meta.role)) {
    await supabase.auth.updateUser({ data: { role: role ?? "candidate" } });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
