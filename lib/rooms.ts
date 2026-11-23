import { getServiceClient } from "./supabase";
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
  const { data: room, error } = await db
    .from("room")
    .select("id, name, room_type, floor, site:site_id(name, code)")
    .eq("qr_token", token)
    .maybeSingle();

  if (error || !room) return null;

  const { data: assets } = await db
    .from("asset")
    .select("brand, model")
    .eq("room_id", room.id);

  // Supabase returns the joined `site` as an object for a to-one relation.
  const site = (room as unknown as { site: { name: string; code: string } }).site;

  return {
    id: room.id as string,
    name: room.name as string,
    roomType: room.room_type as RoomType,
    floor: (room.floor as string | null) ?? null,
    siteName: site?.name ?? "",
    siteCode: site?.code ?? "",
    assets: assets ?? [],
  };
}
