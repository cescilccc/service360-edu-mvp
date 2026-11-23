import { describeServiceKeyRole, getServiceClient } from "./supabase";
import type { RoomType } from "./enums";

export interface ResolvedRoom {
  id: string;
  name: string;
  roomType: RoomType;
  floor: string | null;
  siteName: string;
  siteCode: string;
  assets: { brand: string | null; model: string | null }[];
}

/** Resolve a room (plus its site and assets) from an opaque QR token. */
export async function resolveRoomByToken(
  token: string
): Promise<ResolvedRoom | null> {
  const db = getServiceClient();

  // 1) Room by token — PLAIN columns only (incl. the FK column `site_id`).
  //    No embedded relationship: a PostgREST relationship/schema-cache issue on
  //    an embed would error and surface as "Room not found"; a direct select
  //    cannot. The site is fetched separately below.
  const { data: room, error } = await db
    .from("room")
    .select("id, name, room_type, floor, site_id")
    .eq("qr_token", token)
    .maybeSingle();

  // Do NOT mask a query error as "not found" — surface the real cause.
  if (error) {
    console.error("[room-lookup] room query error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return null;
  }

  if (!room) {
    // Genuinely no matching row. If the row IS known to exist, the query is
    // being filtered by RLS — i.e. it is NOT running as service_role. The token
    // is public (it comes from the URL), so logging it is safe; the key is never
    // logged — only its role label.
    console.warn("[room-lookup] no row for qr_token", {
      token,
      serviceKeyRole: describeServiceKeyRole(),
    });
    return null;
  }

  // 2) Site by id — separate query (no embed). A failure here does not block the
  //    room: the report still works, site label just falls back to empty.
  let siteName = "";
  let siteCode = "";
  if (room.site_id) {
    const { data: site, error: siteError } = await db
      .from("site")
      .select("name, code")
      .eq("id", room.site_id)
      .maybeSingle();
    if (siteError) {
      console.error("[room-lookup] site query error", {
        code: siteError.code,
        message: siteError.message,
        details: siteError.details,
        hint: siteError.hint,
      });
    } else if (site) {
      siteName = (site.name as string | null) ?? "";
      siteCode = (site.code as string | null) ?? "";
    }
  }

  // 3) Assets — separate query.
  const { data: assets } = await db
    .from("asset")
    .select("brand, model")
    .eq("room_id", room.id);

  return {
    id: room.id as string,
    name: room.name as string,
    roomType: room.room_type as RoomType,
    floor: (room.floor as string | null) ?? null,
    siteName,
    siteCode,
    assets: assets ?? [],
  };
}
