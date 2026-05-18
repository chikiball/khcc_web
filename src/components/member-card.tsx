import Link from "next/link";
import { colorClasses, type RideTypeOption } from "@/lib/ride-types";

type MemberCardData = {
  id: string;
  name: string | null;
  image: string | null;
  paceGroup: string;
  bike: string | null;
};

export function MemberCard({
  member,
  rideType,
}: {
  member: MemberCardData;
  rideType?: RideTypeOption;
}) {
  const tone = colorClasses(rideType?.color ?? "coral");
  const initial = (member.name ?? "?")[0]?.toUpperCase() ?? "?";

  return (
    <Link
      href={`/members/${member.id}`}
      className="flex items-center gap-3 rounded-2xl bg-white ring-1 ring-maroon-200/60 px-4 py-3 hover:bg-cream-50 active:scale-[0.99] transition-transform"
    >
      {member.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.image}
          alt=""
          className="size-12 rounded-full object-cover shrink-0"
        />
      ) : (
        <span className="size-12 rounded-full bg-coral-200 text-coral-800 inline-flex items-center justify-center font-display font-bold text-lg shrink-0">
          {initial}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-ink truncate">
          {member.name ?? "Unnamed rider"}
        </p>
        {member.bike && (
          <p className="text-xs text-ink-soft truncate mt-0.5">{member.bike}</p>
        )}
      </div>

      <span
        className={`hex-clip inline-flex shrink-0 items-center justify-center w-9 h-9 ring-1 font-display font-bold text-sm ${tone.bg} ${tone.text} ${tone.ring}`}
        aria-label={`Pace ${member.paceGroup}${rideType ? ` ${rideType.name}` : ""}`}
        title={rideType?.name}
      >
        {member.paceGroup}
      </span>
    </Link>
  );
}
