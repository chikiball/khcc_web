import Link from "next/link";
import { RsvpButton } from "@/components/rsvp-button";

type Ride = {
  id: string;
  title: string;
  starts_at: string;
  start_point_name: string;
  distance_km: number | null;
  elevation_m: number | null;
  pace_group: "A" | "B" | "C";
  status: string;
};

export function RideCard({
  ride,
  rsvpCount,
  isIn,
}: {
  ride: Ride;
  rsvpCount: number;
  isIn: boolean;
}) {
  const start = new Date(ride.starts_at);

  return (
    <article className="rounded-2xl bg-white ring-1 ring-maroon-200/60 overflow-hidden shadow-sm">
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
          <PaceBadge pace={ride.pace_group} />
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

export function PaceBadge({ pace }: { pace: "A" | "B" | "C" }) {
  // Pace is never colour-only — letter is always shown (NFR-6).
  const tone = {
    A: "bg-flash-500/15 text-flash-600 ring-flash-500/30",
    B: "bg-coral-400/15 text-coral-700 ring-coral-400/30",
    C: "bg-maroon-700/15 text-maroon-700 ring-maroon-700/30",
  }[pace];
  return (
    <span
      className={`hex-clip inline-flex shrink-0 items-center justify-center w-12 h-11 ring-1 font-display font-bold text-lg ${tone}`}
      aria-label={`Pace group ${pace}`}
    >
      {pace}
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
