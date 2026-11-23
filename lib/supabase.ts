// Supabase clients. Lazy so the build does not require env vars.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

/** Server-side admin client (service role). Server routes only — never import in a client component. */
export function getServiceClient(): SupabaseClient {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}

/** Anon client for public, read-only lookups (e.g. resolving a room by QR token). */
export function getAnonClient(): SupabaseClient {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false } }
  );
}

/**
 * Classify the role of the configured service-role key for SAFE diagnostics.
 * Never logs or returns the key itself — only a role label, e.g. "service_role",
 * "anon", or "publishable (anon) — NOT service role". A non-service_role result
 * explains "Room not found" under RLS (the query is filtered instead of bypassed).
 */
export function describeServiceKeyRole(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!key) return "missing";
  try {
    if (key.startsWith("sb_secret_")) return "secret (service-role)";
    if (key.startsWith("sb_publishable_"))
      return "publishable (anon) — NOT service role";
    const parts = key.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf8")
      );
      return typeof payload?.role === "string" ? payload.role : "unknown-jwt";
    }
    return "unknown-format";
  } catch {
    return "undecodable";
  }
}
