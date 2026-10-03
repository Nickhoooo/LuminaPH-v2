import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function confirmationFailure(request: NextRequest, type: string | null, serviceError = false) {
  const response = type === "recovery"
    ? NextResponse.redirect(new URL(`/reset-password?error=${serviceError ? "service" : "invalid_link"}`, request.url))
    : new Response(
      serviceError ? "We couldn't verify your email right now. Please try again shortly."
        : "Invalid or expired confirmation link. Please request a new link.",
      { status: serviceError ? 503 : 400, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (!tokenHash || (type !== "email" && type !== "recovery")) {
    return confirmationFailure(request, type);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) return confirmationFailure(request, type);
  } catch {
    return confirmationFailure(request, type, true);
  }

  // Recovery sessions go to password entry; signup confirmations go to studying.
  const response = NextResponse.redirect(
    new URL(type === "recovery" ? "/reset-password" : "/dashboard", request.url),
  );

  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  return response;
}
