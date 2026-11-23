// Coordinator authorization.
//
// A valid Supabase token only proves the caller is SOME authenticated user.
// Authorization here requires the caller's Supabase-VERIFIED email to be on a
// server-side allow-list (the `coordinator` table), read with the service role.
// Authorization never reads client-supplied roles or metadata (which a user can
// set on their own user_metadata), so it cannot be bypassed that way.

import { getServiceClient } from "./supabase";

export type AuthzResult = "UNAUTHENTICATED" | "FORBIDDEN" | "AUTHORIZED";

export interface AuthzDeps {
  /** Verify the bearer token server-side and return the verified identity, or null. */
  verifyToken: (token: string) => Promise<{ email: string } | null>;
  /** Check the server-side allow-list, keyed on the verified email. */
  isCoordinator: (email: string) => Promise<boolean>;
}

export function extractBearer(headers: {
  get(name: string): string | null;
}): string | null {
  const header = headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Pure authorization decision (dependency-injected, unit-testable).
 * UNAUTHENTICATED → no/invalid token; FORBIDDEN → valid user, not a coordinator;
 * AUTHORIZED → verified email is on the allow-list.
 */
export async function authorize(
  token: string | null,
  deps: AuthzDeps
): Promise<AuthzResult> {
  if (!token) return "UNAUTHENTICATED";
  const user = await deps.verifyToken(token);
  if (!user || !user.email) return "UNAUTHENTICATED";
  return (await deps.isCoordinator(user.email)) ? "AUTHORIZED" : "FORBIDDEN";
}

/** Real check wired to Supabase: verifies the token and reads the allow-list. */
export async function requireCoordinator(req: Request): Promise<AuthzResult> {
  const db = getServiceClient();
  return authorize(extractBearer(req.headers), {
    verifyToken: async (token) => {
      try {
        const { data, error } = await db.auth.getUser(token);
        const email = data?.user?.email;
        if (error || !email) return null;
        return { email };
      } catch {
        return null;
      }
    },
    isCoordinator: async (email) => {
      const { data, error } = await db
        .from("coordinator")
        .select("email")
        .eq("email", email)
        .maybeSingle();
      return !error && !!data;
    },
  });
}
