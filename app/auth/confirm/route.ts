import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ConfirmationType = "email" | "recovery";

function confirmationFailure(
  request: NextRequest,
  type: string | null,
  serviceError = false,
) {
  const response = type === "recovery"
    ? NextResponse.redirect(
        new URL(
          `/reset-password?error=${serviceError ? "service" : "invalid_link"}`,
          request.url,
        ),
        303,
      )
    : new Response(
        serviceError
          ? "We couldn't verify your email right now. Please try again shortly."
          : "This confirmation link is invalid or has expired. Request a new email link and try again.",
        {
          status: serviceError ? 503 : 400,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function confirmationPage(tokenHash: string, type: ConfirmationType) {
  const recovery = type === "recovery";
  const heading = recovery ? "Continue to password reset" : "Confirm your email";
  const message = recovery
    ? "Continue only if you requested a password reset."
    : "Confirm your email address to finish creating your Lumina PH account.";
  const button = recovery ? "Continue to reset password" : "Confirm email address";

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>${heading} · Lumina PH</title>
  </head>
  <body style="margin:0;background:#f3f6f1;color:#20342c;font-family:Arial,Helvetica,sans-serif">
    <main style="box-sizing:border-box;max-width:32rem;margin:12vh auto;padding:2.5rem 2rem;background:#fff;border:1px solid #dce5d7;border-radius:1.25rem">
      <p style="margin:0 0 1rem;color:#08785d;font-size:.8rem;font-weight:700">Lumina PH</p>
      <h1 style="margin:0;font-size:1.75rem;line-height:1.2">${heading}</h1>
      <p style="margin:1rem 0 1.75rem;color:#52665a;line-height:1.6">${message}</p>
      <form method="post" action="/auth/confirm">
        <input type="hidden" name="token_hash" value="${escapeHtml(tokenHash)}">
        <input type="hidden" name="type" value="${type}">
        <button type="submit" style="min-height:3rem;padding:.75rem 1.25rem;border:0;border-radius:.65rem;background:#08785d;color:#fff;font-size:1rem;font-weight:700;cursor:pointer">${button}</button>
      </form>
    </main>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

function isConfirmationType(value: string | null): value is ConfirmationType {
  return value === "email" || value === "recovery";
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (!tokenHash || !isConfirmationType(type)) {
    return confirmationFailure(request, type);
  }

  // Email security scanners often open links automatically. Keep GET read-only
  // and require an explicit form submission before consuming the one-time token.
  return confirmationPage(tokenHash, type);
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return confirmationFailure(request, null);
  }

  const tokenHash = formData.get("token_hash");
  const typeValue = formData.get("type");
  const type = typeof typeValue === "string" ? typeValue : null;

  if (typeof tokenHash !== "string" || !tokenHash || !isConfirmationType(type)) {
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

  const destination = type === "recovery" ? "/reset-password" : "/dashboard";
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
