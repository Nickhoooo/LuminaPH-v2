import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/study-tools/:path*",
    "/library/:path*",
    "/admin/:path*",
    "/login",
    "/signup",
    "/reset-password",
    "/auth/:path*",
  ],
};
