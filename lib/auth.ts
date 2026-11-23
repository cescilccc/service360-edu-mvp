import { getServiceClient } from "./supabase";

/** Returns true if the request carries a valid Supabase user access token. */
export async function isAuthenticated(req: Request): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;
  try {
    const { data, error } = await getServiceClient().auth.getUser(token);
    return !error && !!data.user;
  } catch {
    return false;
  }
}
