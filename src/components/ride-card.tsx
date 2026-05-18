import Link from "next/link";
import { colorClasses, type RideTypeOption } from "@/lib/ride-types";
import type { RidePaceGroup } from "@/db/schema";

type Ride = {
  id: string;
  title: string;
  starts_at: string;
  start_point_name: string;
  status: string;
};

type PaceWithCount = {
  paceGroup: RidePaceGroup;
  rideType?: RideTypeOption;
  count: number;
};

export function RideCard({
  ride,
  paces,
  previewUrl,
}: {
  ride: Ride;
  paces: PaceWithCount[];
  previewUrl?: string | null;
}) {
  const start = new Date(ride.starts_at);
  const totalCount = paces.reduce((s, p) => s + p.count, 0);
  const activePaces = paces.filter((p) => p.paceGroup.status !== "cancelled");

  return (
    <article className="rounded-2xl bg-white ring-1 ring-maroon-200/60 overflow-hidden shadow-sm">
      {previewUrl && (
        <Link href={`/rides/${ride.id}`} className="block relative aspect-[2/1] bg-cream-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
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
            <p className="text-sm text-ink-soft mt-0.5 truncate">{ride.start_point_name}</p>
          </div>

          {/* Pace strip with per-pace RSVP counts */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {activePaces.map(({ paceGroup, rideType, count }) => {
              const tone = colorClasses(rideType?.color ?? "coral");
              return (
                <div key={paceGroup.id} className="flex items-center gap-1.5">
                  <span className="text-xs text-ink-soft tabular-nums">{count}</span>
                  <span
                    className={`hex-clip inline-flex items-center justify-center w-10 h-10 font-display font-bold text-base ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
                    aria-label={`${paceGroup.paceCode}${rideType ? ` ${rideType.name}` : ""}`}
                    title={rideType?.name}
                  >
                    {paceGroup.paceCode}
                  </span>
                </div>
              );
            })}
            {paces.length > 0 && (
              <span className="text-[10px] text-ink-soft/70 text-right">{totalCount} total</span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}

export function PaceBadge({ code, rideType }: { code: string; rideType?: RideTypeOption }) {
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
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
