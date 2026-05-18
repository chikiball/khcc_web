import Link from "next/link";
import { RsvpButton } from "@/components/rsvp-button";
import { colorClasses, type RideTypeOption } from "@/lib/ride-types";

type Ride = {
  id: string;
  title: string;
  starts_at: string;
  start_point_name: string;
  distance_km: number | null;
  elevation_m: number | null;
  pace_group: string;
  status: string;
};

export function RideCard({
  ride,
  rsvpCount,
  isIn,
  rideType,
  previewUrl,
}: {
  ride: Ride;
  rsvpCount: number;
  isIn: boolean;
  rideType?: RideTypeOption;
  previewUrl?: string | null;
}) {
  const start = new Date(ride.starts_at);

  return (
    <article className="rounded-2xl bg-white ring-1 ring-maroon-200/60 overflow-hidden shadow-sm">
      {previewUrl && (
        <Link href={`/rides/${ride.id}`} className="block relative aspect-[2/1] bg-cream-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        </Link>
      )}
      <Link href={`/rides/${ride.id}`} className="block p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-coral-600">
              {formatDay(start)} · {formatTime(start)}
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-ink truncate">
              {ride.title}
            </h3>
            <p className="text-sm text-ink-soft mt-0.5 truncate">
              {ride.start_point_name}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <PaceBadge code={ride.pace_group} rideType={rideType} />
            {rideType && (
              <span className="text-[10px] uppercase tracking-wider text-ink-soft text-right max-w-[8rem] truncate">
                {rideType.name}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-ink-soft">
          {ride.distance_km != null && (
            <span>
              <span className="font-semibold text-ink">{ride.distance_km}</span> km
            </span>
          )}
          {ride.elevation_m != null && (
            <span>
              <span className="font-semibold text-ink">{ride.elevation_m}</span> m
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-coral-500" aria-hidden="true" />
            <span className="font-medium">{rsvpCount}</span> in
          </span>
        </div>
      </Link>

      <div className="px-5 pb-5 -mt-1 flex items-center justify-end">
        <RsvpButton rideId={ride.id} isIn={isIn} size="sm" />
      </div>
    </article>
  );
}

export function PaceBadge({
  code,
  rideType,
}: {
  code: string;
  rideType?: RideTypeOption;
}) {
  // Letter is always shown alongside any colour cue (NFR-6 — pace group
  // never colour-only). Falls back to coral if the type's color preset
  // is missing or the type isn't passed in.
  const tone = colorClasses(rideType?.color ?? "coral");
  return (
    <span
      className={`hex-clip inline-flex shrink-0 items-center justify-center w-12 h-11 ring-1 font-display font-bold text-lg ${tone.bg} ${tone.text} ${tone.ring}`}
      aria-label={`Pace group ${code}${rideType ? `, ${rideType.name}` : ""}`}
      title={rideType?.name}
    >
      {code}
    </span>
  );
}

function formatDay(d: Date) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
