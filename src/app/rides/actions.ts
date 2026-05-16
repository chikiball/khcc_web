"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function toggleRsvp(rideId: string, currentlyIn: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (currentlyIn) {
    const { error } = await supabase
      .from("ride_rsvps")
      .delete()
      .eq("ride_id", rideId)
      .eq("user_id", user.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("ride_rsvps")
      .upsert({ ride_id: rideId, user_id: user.id, status: "in" });
    if (error) throw error;
  }

  revalidatePath("/rides");
  revalidatePath(`/rides/${rideId}`);
}
