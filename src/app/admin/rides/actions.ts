"use server";

import { db, schema } from "@/db";
import { requireRideManager } from "@/lib/auth-helpers";
import { parseGpx, parseGpxCoords } from "@/lib/gpx";
import { saveRouteGpx } from "@/lib/upload";
import { generateRoutePreview } from "@/lib/static-map";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";

// ── Types ────────────────────────────────────────────────────────────────────

type RideInput = {
  title: string;
  starts_at: string;
  start_point_name: string;
  start_point_lat?: string;
  start_point_lng?: string;
  distance_km?: string;
  elevation_m?: string;
  route_url?: string;
  description?: string;
};

export type PaceGroupInput = {
  id?: string;       // existing row — omit for new
  pace_code: string;
  leader_id?: string;
  distance_km?: string;
  elevation_m?: string;
  cap?: string;
  notes?: string;
  position?: number;
  status?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseRideInput(formData: FormData): RideInput {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const title = get("title");
  const starts_at = get("starts_at");
  const start_point_name = get("start_point_name");
  if (!title) throw new Error("Title is required.");
  if (!starts_at) throw new Error("Date and time is required.");
  if (!start_point_name) throw new Error("Start point is required.");
  return {
    title, starts_at, start_point_name,
    start_point_lat: get("start_point_lat") || undefined,
    start_point_lng: get("start_point_lng") || undefined,
    distance_km: get("distance_km") || undefined,
    elevation_m: get("elevation_m") || undefined,
    route_url: get("route_url") || undefined,
    description: get("description") || undefined,
  };
}

function parsePaceGroups(formData: FormData): PaceGroupInput[] {
  const raw = String(formData.get("pace_groups") ?? "[]");
  try {
    const arr = JSON.parse(raw) as PaceGroupInput[];
    if (!arr.length) throw new Error("At least one pace group is required.");
    for (const pg of arr) {
      if (!pg.pace_code) throw new Error("Every pace group needs a pace code.");
    }
    return arr;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error("Invalid pace groups data.");
  }
}

function rideRow(input: RideInput) {
  return {
    title: input.title,
    startsAt: new Date(input.starts_at),
    startPointName: input.start_point_name,
    startPointLat: input.start_point_lat ?? null,
    startPointLng: input.start_point_lng ?? null,
    distanceKm: input.distance_km ?? null,
    elevationM: input.elevation_m ? Number(input.elevation_m) : null,
    routeUrl: input.route_url ?? null,
    description: input.description ?? null,
  };
}

async function maybeMergeGpx(
  formData: FormData,
  input: RideInput,
): Promise<{ file: File; text: string } | null> {
  const file = formData.get("gpx");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.name.toLowerCase().endsWith(".gpx")) throw new Error("Route file must end in .gpx.");
  if (file.size > 5 * 1024 * 1024) throw new Error("GPX file is too big (5 MB max).");
  const text = await file.text();
  const parsed = parseGpx(text);
  input.distance_km = String(parsed.distanceKm);
  input.elevation_m = String(parsed.elevationM);
  return { file, text };
}

async function tryGeneratePreview(text: string, rideId: string): Promise<void> {
  try {
    await generateRoutePreview(parseGpxCoords(text), rideId);
  } catch (err) {
    console.error("[route preview]", err instanceof Error ? err.message : err);
  }
}

async function syncPaceGroups(
  rideId: string,
  paceGroups: PaceGroupInput[],
  managedBy: string,
): Promise<void> {
  const existing = await db
    .select({ id: schema.ridePaceGroups.id })
    .from(schema.ridePaceGroups)
    .where(eq(schema.ridePaceGroups.rideId, rideId));
  const existingIds = new Set(existing.map((r) => r.id));
  const submittedIds = new Set(paceGroups.filter((pg) => pg.id).map((pg) => pg.id!));

  // Delete removed pace groups (cascades RSVPs)
  const toDelete = [...existingIds].filter((id) => !submittedIds.has(id));
  if (toDelete.length) {
    await db
      .delete(schema.ridePaceGroups)
      .where(inArray(schema.ridePaceGroups.id, toDelete));
  }

  for (let i = 0; i < paceGroups.length; i++) {
    const pg = paceGroups[i];
    const row = {
      rideId,
      paceCode: pg.pace_code,
      leaderId: pg.leader_id || null,
      distanceKm: pg.distance_km || null,
      elevationM: pg.elevation_m ? Number(pg.elevation_m) : null,
      cap: pg.cap ? Number(pg.cap) : null,
      notes: pg.notes || null,
      position: pg.position ?? i,
      updatedAt: new Date(),
    };
    if (pg.id && existingIds.has(pg.id)) {
      await db
        .update(schema.ridePaceGroups)
        .set(row)
        .where(eq(schema.ridePaceGroups.id, pg.id));
    } else {
      await db.insert(schema.ridePaceGroups).values({ ...row });
    }
  }
}

// ── Public actions ────────────────────────────────────────────────────────────

export async function createRide(formData: FormData) {
  await requireRideManager();
  const input = parseRideInput(formData);
  const paceGroups = parsePaceGroups(formData);
  const gpx = await maybeMergeGpx(formData, input);

  const [created] = await db
    .insert(schema.rides)
    .values(rideRow(input))
    .returning({ id: schema.rides.id });

  await syncPaceGroups(created.id, paceGroups, "");

  if (gpx) {
    await saveRouteGpx(gpx.file, created.id);
    await tryGeneratePreview(gpx.text, created.id);
  }

  revalidatePath("/rides");
  revalidatePath("/admin/rides");
  redirect(`/rides/${created.id}`);
}

export async function updateRide(rideId: string, formData: FormData) {
  const manager = await requireRideManager();
  const input = parseRideInput(formData);
  const paceGroups = parsePaceGroups(formData);
  const gpx = await maybeMergeGpx(formData, input);

  await db
    .update(schema.rides)
    .set({ ...rideRow(input), updatedAt: new Date() })
    .where(eq(schema.rides.id, rideId));

  await syncPaceGroups(rideId, paceGroups, manager.id);

  if (gpx) {
    await saveRouteGpx(gpx.file, rideId);
    await tryGeneratePreview(gpx.text, rideId);
  }

  revalidatePath("/rides");
  revalidatePath(`/rides/${rideId}`);
  revalidatePath("/admin/rides");
  redirect("/admin/rides");
}

export async function cancelRide(rideId: string, formData: FormData) {
  const user = await requireRideManager();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("A cancellation reason is required.");

  // Cancel the whole ride AND all active pace groups
  await db.update(schema.rides).set({
    status: "cancelled",
    cancelledAt: new Date(),
    cancelledBy: user.id,
    cancelledReason: reason,
    updatedAt: new Date(),
  }).where(eq(schema.rides.id, rideId));

  await db.update(schema.ridePaceGroups).set({
    status: "cancelled",
    cancelledAt: new Date(),
    cancelledBy: user.id,
    cancelledReason: reason,
    updatedAt: new Date(),
  }).where(eq(schema.ridePaceGroups.rideId, rideId));

  revalidatePath("/rides");
  revalidatePath(`/rides/${rideId}`);
  revalidatePath("/admin/rides");
  redirect("/admin/rides?status=cancelled");
}

export async function cancelPaceGroup(paceGroupId: string, formData: FormData) {
  const user = await requireRideManager();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("A cancellation reason is required.");

  await db.update(schema.ridePaceGroups).set({
    status: "cancelled",
    cancelledAt: new Date(),
    cancelledBy: user.id,
    cancelledReason: reason,
    updatedAt: new Date(),
  }).where(eq(schema.ridePaceGroups.id, paceGroupId));

  // If all pace groups for this ride are now cancelled, cancel the ride too
  const active = await db
    .select({ id: schema.ridePaceGroups.id })
    .from(schema.ridePaceGroups)
    .where(
      eq(schema.ridePaceGroups.status, "scheduled"),
    );
  // re-fetch to check this ride's pace groups specifically
  const all = await db
    .select({ id: schema.ridePaceGroups.id, status: schema.ridePaceGroups.status, rideId: schema.ridePaceGroups.rideId })
    .from(schema.ridePaceGroups)
    .where(eq(schema.ridePaceGroups.id, paceGroupId));
  if (all.length > 0) {
    const rideId = all[0].rideId;
    const remaining = await db
      .select({ id: schema.ridePaceGroups.id })
      .from(schema.ridePaceGroups)
      .where(eq(schema.ridePaceGroups.rideId, rideId));
    const anyActive = remaining.some((r) => (r as { status?: string }).status === "scheduled");
    // Can't check status above because we already updated. Re-select with status.
    const withStatus = await db
      .select({ status: schema.ridePaceGroups.status })
      .from(schema.ridePaceGroups)
      .where(eq(schema.ridePaceGroups.rideId, rideId));
    const stillActive = withStatus.some((r) => r.status === "scheduled");
    if (!stillActive) {
      await db.update(schema.rides).set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: user.id,
        cancelledReason: "All pace groups cancelled.",
        updatedAt: new Date(),
      }).where(eq(schema.rides.id, rideId));
    }
    revalidatePath(`/rides/${rideId}`);
    revalidatePath("/admin/rides");
    redirect(`/admin/rides/${rideId}/edit`);
  }
  revalidatePath("/rides");
  revalidatePath("/admin/rides");
  redirect("/admin/rides");
}

export async function loadPaceGroups(rideId: string) {
  return db
    .select()
    .from(schema.ridePaceGroups)
    .where(eq(schema.ridePaceGroups.rideId, rideId))
    .orderBy(asc(schema.ridePaceGroups.position));
}
