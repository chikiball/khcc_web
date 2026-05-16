"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const PACE = ["A", "B", "C"] as const;
type Pace = (typeof PACE)[number];

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const display_name = String(formData.get("display_name") ?? "").trim();
  const pace_group = String(formData.get("pace_group") ?? "B") as Pace;
  const bike = String(formData.get("bike") ?? "").trim() || null;
  const strava_handle = String(formData.get("strava_handle") ?? "").trim() || null;
  const emergency_name = String(formData.get("emergency_name") ?? "").trim() || null;
  const emergency_phone = String(formData.get("emergency_phone") ?? "").trim() || null;

  if (!display_name) {
    throw new Error("Display name is required.");
  }
  if (!PACE.includes(pace_group)) {
    throw new Error("Pick a pace group.");
  }

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      display_name,
      pace_group,
      bike,
      strava_handle,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileErr) throw profileErr;

  const { error: privateErr } = await supabase
    .from("profiles_private")
    .update({
      emergency_contact_name: emergency_name,
      emergency_contact_phone: emergency_phone,
    })
    .eq("id", user.id);

  if (privateErr) throw privateErr;

  revalidatePath("/rides");
  redirect("/rides");
}
