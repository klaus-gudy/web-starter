"use server";

import { redirect } from "next/navigation";

// Placeholders: no auth provider is wired up yet, so both forms just enter
// the app. Replace the bodies with real sign-in / sign-up calls.

export async function login(formData: FormData) {
  void formData;
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  void formData;
  redirect("/dashboard");
}
