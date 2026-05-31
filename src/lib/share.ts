/**
 * Build a WhatsApp-friendly plain-text summary of a ride. Used by the
 * "Copy for WhatsApp" button on the ride detail page.
 *
 * Date/time is formatted in Asia/Singapore regardless of the server's
 * timezone (the production container runs UTC by default, but the user
 * pasting this into WhatsApp wants SGT).
 */
export function buildRideShareText(input: {
  siteUrl: string;
  rideId: string;
  title: string;
  startsAt: Date;
  startPointName: string;
  distanceKm: number | null;
  elevationM: number | null;
  isCancelled: boolean;
  paceGroups: Array<{
    code: string;
    name: string;
    status: string;
    riders: string[];
  }>;
}): string {
  const lines: string[] = [];

  lines.push(input.isCancelled ? `❌ CANCELLED — ${input.title}` : `🚴 ${input.title}`);
  lines.push("");

  const dateStr = input.startsAt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Singapore",
  });
  const timeStr = input.startsAt.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore",
  });
  lines.push(`📅 ${dateStr}, ${timeStr}`);
  lines.push(`📍 ${input.startPointName}`);

  if (input.distanceKm != null || input.elevationM != null) {
    const stats: string[] = [];
    if (input.distanceKm != null) stats.push(`${input.distanceKm} km`);
    if (input.elevationM != null) stats.push(`↗ ${input.elevationM} m`);
    lines.push(`📏 ${stats.join(" · ")}`);
  }

  // Per-pace blocks. Skip cancelled paces (sharing is for inviting, not
  // documenting cancellations — those still show on the page itself).
  const livePaces = input.paceGroups.filter((p) => p.status !== "cancelled");
  for (const pg of livePaces) {
    lines.push("");
    lines.push(`${pg.name} (${pg.riders.length}):`);
    pg.riders.forEach((name, i) => {
      lines.push(`${i + 1}. ${name}`);
    });
  }

  lines.push("");
  lines.push(`Join: ${input.siteUrl}/rides/${input.rideId}`);

  return lines.join("\n");
}
