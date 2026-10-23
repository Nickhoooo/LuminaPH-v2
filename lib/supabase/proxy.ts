import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase URL or publishable key.");
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  // Walang authenticated session: walang suspension status na kailangang i-check.
  if (claimsError || !claimsData?.claims?.sub) {
    return response;
  }

  const { data: isSuspended, error: suspensionError } = await supabase.rpc(
    "is_current_account_suspended",
  );

  // Fail closed kung hindi makumpirma ang account status.
  if (suspensionError || typeof isSuspended !== "boolean") {
    return redirectWithCookies(request, response, "/account-status-check");
  }

  if (isSuspended) {
    return redirectWithCookies(request, response, "/account-suspended");
  }

  return response;
}

function redirectWithCookies(
  request: NextRequest,
  currentResponse: NextResponse,
  path: string,
) {
  const redirectResponse = NextResponse.redirect(new URL(path, request.url));

  // Keep any refreshed Supabase session cookies from updateSession.
  for (const cookie of currentResponse.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}
