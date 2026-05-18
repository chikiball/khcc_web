"use server";

import { db, schema } from "@/db";
import { requireRideManager } from "@/lib/auth-helpers";
import { parseGpx } from "@/lib/gpx";
import { saveRouteGpx } from "@/lib/upload";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

type RideInput = {
  title: string;
  starts_at: string;
  start_point_name: string;
  start_point_lat?: string;
  start_point_lng?: string;
  distance_km?: string;
  elevation_m?: string;
  pace_group: string;
  route_url?: string;
  description?: string;
  cap?: string;
  leader_id?: string;
};

function parseRideInput(formData: FormData): RideInput {
  const get = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v.trim() : "";
  };

  const title = get("title");
  const starts_at = get("starts_at");
  const start_point_name = get("start_point_name");
  const pace_group = get("pace_group");

  if (!title) throw new Error("Title is required.");
  if (!starts_at) throw new Error("Date and time is required.");
  if (!start_point_name) throw new Error("Start point is required.");
  if (!pace_group) throw new Error("Pick a pace group.");

  return {
    title,
    starts_at,
    start_point_name,
    start_point_lat: get("start_point_lat") || undefined,
    start_point_lng: get("start_point_lng") || undefined,
    distance_km: get("distance_km") || undefined,
    elevation_m: get("elevation_m") || undefined,
    pace_group,
    route_url: get("route_url") || undefined,
    description: get("description") || undefined,
    cap: get("cap") || undefined,
    leader_id: get("leader_id") || undefined,
  };
}

function toRow(input: RideInput) {
  return {
    title: input.title,
    startsAt: new Date(input.starts_at),
    startPointName: input.start_point_name,
    startPointLat: input.start_point_lat ?? null,
    startPointLng: input.start_point_lng ?? null,
    distanceKm: input.distance_km ?? null,
    elevationM: input.elevation_m ? Number(input.elevation_m) : null,
    paceGroup: input.pace_group,
    routeUrl: input.route_url ?? null,
    description: input.description ?? null,
    cap: input.cap ? Number(input.cap) : null,
    leaderId: input.leader_id ?? null,
  };
}

/**
 * If a .gpx file was uploaded, parse it and merge distance + elevation
 * into the input — but only where the leader didn't type a value
 * themselves. Leader-typed values always win over GPX-derived values.
 * Returns the File so the caller can persist it once the ride id exists.
 */
async function maybeMergeGpx(
  formData: FormData,
  input: RideInput,
): Promise<File | null> {
  const file = formData.get("gpx");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.name.toLowerCase().endsWith(".gpx")) {
    throw new Error("Route file must end in .gpx.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("GPX file is too big (5 MB max).");
  }

  const text = await file.text();
  const parsed = parseGpx(text);

  if (!input.distance_km) input.distance_km = String(parsed.distanceKm);
  if (!input.elevation_m) input.elevation_m = String(parsed.elevationM);

  return file;
}

export async function createRide(formData: FormData) {
  // Re-check role at action time — never trust the client.
  await requireRideManager();
  const input = parseRideInput(formData);
  const gpxFile = await maybeMergeGpx(formData, input);

  const [created] = await db
    .insert(schema.rides)
    .values(toRow(input))
    .returning({ id: schema.rides.id });

  if (gpxFile) await saveRouteGpx(gpxFile, created.id);

  revalidatePath("/rides");
  revalidatePath("/admin/rides");
  redirect(`/rides/${created.id}`);
}

export async function updateRide(rideId: string, formData: FormData) {
  await requireRideManager();
  const input = parseRideInput(formData);
  const gpxFile = await maybeMergeGpx(formData, input);

  await db
    .update(schema.rides)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(eq(schema.rides.id, rideId));

  if (gpxFile) await saveRouteGpx(gpxFile, rideId);

  revalidatePath("/rides");
  revalidatePath(`/rides/${rideId}`);
  revalidatePath("/admin/rides");
  redirect(`/admin/rides`);
}

export async function cancelRide(rideId: string, formData: FormData) {
  const user = await requireRideManager();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) throw new Error("A cancellation reason is required.");

  await db
    .update(schema.rides)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: user.id,
      cancelledReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(schema.rides.id, rideId));

  revalidatePath("/rides");
  revalidatePath(`/rides/${rideId}`);
  revalidatePath("/admin/rides");
  redirect(`/admin/rides?status=cancelled`);
}
