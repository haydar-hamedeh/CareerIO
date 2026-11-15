import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/feed/:path*", "/onboarding/:path*", "/profile/:path*", "/grader/:path*", "/login", "/signup", "/auth/:path*", "/reset-password"],
};
