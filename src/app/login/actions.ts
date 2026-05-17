"use server";

import { signIn } from "@/auth";

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  await signIn("credentials", { email, redirectTo: "/" });
}

export async function signInWithGoogle() {
  // OAuth path — server action initiates the redirect to Google;
  // the callback handler at /api/auth/callback/google completes sign-in
  // and the JWT cookie is set, then we land at "/" which routes by status.
  await signIn("google", { redirectTo: "/" });
}
