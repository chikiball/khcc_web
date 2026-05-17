"use server";

import { signIn } from "@/auth";

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  // signIn() throws a NEXT_REDIRECT internally on success — this never
  // returns normally on a successful sign-in. On a credentials reject
  // (returned null from authorize), Auth.js redirects to /login?error=...
  await signIn("credentials", { email, redirectTo: "/" });
}
