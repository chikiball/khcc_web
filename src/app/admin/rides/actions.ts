"use server";

import { db, schema } from "@/db";
import { requireRideManager } from "@/lib/auth-helpers";
import { parseGpx, parseGpxCoords } from "@/lib/gpx";
import { saveRouteGpx, copyLibraryGpxToRide } from "@/lib/upload";
import { generateRoutePreview } from "@/lib/static-map";
import { materializeSeries } from "@/lib/series";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, and, eq, inArray } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Marker class for validation errors that should be surfaced inline on the
 * form rather than as a generic 500 page. The caller catches FormError and
 * redirects back to the source page with `?error=<message>`. Anything else
 * propagates as a real server error.
 */
class FormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormError";
  }
}

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
  if (!title) throw new FormError("Title is required.");
  if (!starts_at) throw new FormError("Date and time is required.");
  if (!start_point_name) throw new FormError("Start point is required.");
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
    if (!arr.length) throw new FormError("At least one pace group is required.");
    for (const pg of arr) {
      if (!pg.pace_code) throw new FormError("Every pace group needs a pace code.");
    }
    return arr;
  } catch (e) {
    if (e instanceof FormError) throw e;
    if (e instanceof Error) throw new FormError(e.message);
    throw new FormError("Invalid pace groups data.");
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

type GpxSource =
  | { kind: "upload"; file: File; text: string }
  | { kind: "library"; libraryId: string; text: string };

async function maybeResolveGpxSource(
  formData: FormData,
  input: RideInput,
): Promise<GpxSource | null> {
  const file = formData.get("gpx");
  // Upload wins if a real file came through (defensive — the picker should
  // ensure only one source is submitted).
  if (file instanceof File && file.size > 0) {
    if (!file.name.toLowerCase().endsWith(".gpx")) throw new FormError("Route file must end in .gpx.");
    if (file.size > 5 * 1024 * 1024) throw new FormError("GPX file is too big (5 MB max).");
    const text = await file.text();
    let parsed;
    try {
      parsed = parseGpx(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not parse GPX file.";
      throw new FormError(msg);
    }
    input.distance_km = String(parsed.distanceKm);
    input.elevation_m = String(parsed.elevationM);
    return { kind: "upload", file, text };
  }

  const libraryId = String(formData.get("library_route_id") ?? "").trim();
  if (libraryId) {
    const [row] = await db
      .select()
      .from(schema.routeLibrary)
      .where(eq(schema.routeLibrary.id, libraryId))
      .limit(1);
    if (!row) throw new FormError("Library route not found.");

    const src = path.join(process.cwd(), "public", "uploads", "library", `${libraryId}.gpx`);
    let text: string;
    try {
      text = await readFile(src, "utf8");
    } catch {
      throw new FormError("Library route file is missing on disk.");
    }
    let parsed;
    try {
      parsed = parseGpx(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not parse library GPX.";
      throw new FormError(msg);
    }
    input.distance_km = String(parsed.distanceKm);
    input.elevation_m = String(parsed.elevationM);
    return { kind: "library", libraryId, text };
  }

  return null;
}

async function tryGeneratePreview(text: string, rideId: string): Promise<void> {
  try {
    await generateRoutePreview(parseGpxCoords(text), rideId);
  } catch (err) {
    console.error("[route preview]", err instanceof Error ? err.message : err);
  }
}

async function persistGpxForRide(gpx: GpxSource, rideId: string): Promise<void> {
  if (gpx.kind === "upload") {
    await saveRouteGpx(gpx.file, rideId);
  } else {
    await copyLibraryGpxToRide(gpx.libraryId, rideId);
  }
  await tryGeneratePreview(gpx.text, rideId);
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

  let input: RideInput;
  let paceGroups: PaceGroupInput[];
  let gpx: GpxSource | null;
  try {
    input = parseRideInput(formData);
    paceGroups = parsePaceGroups(formData);
    gpx = await maybeResolveGpxSource(formData, input);
  } catch (err) {
    if (err instanceof FormError) {
      redirect(`/admin/rides/new?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }

  // Check if this is a recurring ride
  const recurrence = (String(formData.get("recurrence") ?? "")).trim();
  if (recurrence === "weekly" || recurrence === "biweekly") {
    // Build the time-of-day from the starts_at field
    const startsAt = new Date(input.starts_at);
    const hh = String(startsAt.getHours()).padStart(2, "0");
    const mm = String(startsAt.getMinutes()).padStart(2, "0");

    const [series] = await db.insert(schema.rideSeries).values({
      title: input.title,
      rule: recurrence,
      weekday: startsAt.getDay(),
      timeOfDay: `${hh}:${mm}`,
      startPointName: input.start_point_name,
      startPointLat: input.start_point_lat ?? null,
      startPointLng: input.start_point_lng ?? null,
      distanceKm: input.distance_km ?? null,
      elevationM: input.elevation_m ? Number(input.elevation_m) : null,
      routeUrl: input.route_url ?? null,
      description: input.description ?? null,
      paceGroupsTemplate: JSON.stringify(paceGroups),
    }).returning();

    // Materialise the first occurrence on the exact selected date PLUS
    // subsequent ones within 4 weeks
    const firstRide = await db.insert(schema.rides).values({
      ...rideRow(input),
      seriesId: series.id,
    }).returning({ id: schema.rides.id });
    await syncPaceGroups(firstRide[0].id, paceGroups, "");
    if (gpx) {
      await persistGpxForRide(gpx, firstRide[0].id);
    }

    // Materialise additional occurrences for the next 4 weeks
    await materializeSeries(series);

    revalidatePath("/rides");
    revalidatePath("/admin/rides");
    redirect("/admin/rides");
  }

  // One-off ride
  const [created] = await db
    .insert(schema.rides)
    .values(rideRow(input))
    .returning({ id: schema.rides.id });

  await syncPaceGroups(created.id, paceGroups, "");

  if (gpx) {
    await persistGpxForRide(gpx, created.id);
  }

  revalidatePath("/rides");
  revalidatePath("/admin/rides");
  redirect(`/rides/${created.id}`);
}

export async function updateRide(rideId: string, formData: FormData) {
  const manager = await requireRideManager();

  let input: RideInput;
  let paceGroups: PaceGroupInput[];
  let gpx: GpxSource | null;
  try {
    input = parseRideInput(formData);
    paceGroups = parsePaceGroups(formData);
    gpx = await maybeResolveGpxSource(formData, input);
  } catch (err) {
    if (err instanceof FormError) {
      redirect(`/admin/rides/${rideId}/edit?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }

  await db
    .update(schema.rides)
    .set({ ...rideRow(input), updatedAt: new Date() })
    .where(eq(schema.rides.id, rideId));

  await syncPaceGroups(rideId, paceGroups, manager.id);

  if (gpx) {
    await persistGpxForRide(gpx, rideId);
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

  // If this ride was part of an active recurring series, immediately
  // materialise the next occurrence so the rides list isn't left empty.
  const [cancelled] = await db
    .select({ seriesId: schema.rides.seriesId })
    .from(schema.rides)
    .where(eq(schema.rides.id, rideId))
    .limit(1);
  if (cancelled?.seriesId) {
    const [series] = await db
      .select()
      .from(schema.rideSeries)
      .where(eq(schema.rideSeries.id, cancelled.seriesId))
      .limit(1);
    if (series?.active) await materializeSeries(series);
  }

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

      // Recurring? Spawn the next occurrence so the list isn't empty.
      const [parent] = await db
        .select({ seriesId: schema.rides.seriesId })
        .from(schema.rides)
        .where(eq(schema.rides.id, rideId))
        .limit(1);
      if (parent?.seriesId) {
        const [series] = await db
          .select()
          .from(schema.rideSeries)
          .where(eq(schema.rideSeries.id, parent.seriesId))
          .limit(1);
        if (series?.active) await materializeSeries(series);
      }
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

export async function stopSeries(seriesId: string) {
  await requireRideManager();
  await db
    .update(schema.rideSeries)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(schema.rideSeries.id, seriesId));
  revalidatePath("/admin/rides");
  redirect("/admin/rides");
}

export async function markRideCompleted(rideId: string) {
  await requireRideManager();
  await db
    .update(schema.rides)
    .set({ status: "completed", updatedAt: new Date() })
    .where(and(eq(schema.rides.id, rideId), eq(schema.rides.status, "scheduled")));
  revalidatePath("/rides");
  revalidatePath("/rides/past");
  revalidatePath(`/rides/${rideId}`);
  redirect(`/rides/${rideId}`);
}
