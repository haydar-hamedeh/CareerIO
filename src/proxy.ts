import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/feed/:path*",
    "/onboarding/:path*",
    "/profile/:path*",
    "/grader/:path*",
    "/jobs/:path*",
    "/recruiter/:path*",
    "/applications/:path*",
    "/messages/:path*",
    "/settings/:path*",
    "/companies/:path*",
    "/login",
    "/signup",
    "/auth/:path*",
    "/reset-password",
  ],
};
