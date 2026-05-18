import { type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { materializeSeries } from "@/lib/series";

/**
 * Cron endpoint — materialises upcoming occurrences for all active ride series.
 *
 * Protect with CRON_SECRET in .env so arbitrary callers cannot spam
 * ride creation. Pass as query param or X-Cron-Secret header.
 *
 * Recommended crontab (every Sunday at 03:00 SGT = 19:00 UTC Sat):
 *   0 19 * * 6 curl -s "https://khcc.nandharu.uk/api/cron/materialize-rides?secret=<CRON_SECRET>" \
 *              >> /var/log/khcc-cron.log 2>&1
 *
 * Or run manually at any time — materialisation is idempotent.
 */
export async function GET(req: NextRequest) {
  const secret =
    req.nextUrl.searchParams.get("secret") ??
    req.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeSeries = await db
    .select()
    .from(schema.rideSeries)
    .where(eq(schema.rideSeries.active, true));

  let totalCreated = 0;
  const results: Array<{ seriesId: string; title: string; created: number }> = [];

  for (const series of activeSeries) {
    const created = await materializeSeries(series);
    results.push({ seriesId: series.id, title: series.title, created });
    totalCreated += created;
  }

  console.log(`[cron/materialize-rides] series: ${activeSeries.length}, created: ${totalCreated}`);
  return Response.json({ series: activeSeries.length, totalCreated, results });
}
