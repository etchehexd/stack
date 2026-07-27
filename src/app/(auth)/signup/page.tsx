import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "../auth-form";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <AuthForm mode="signup" />
    </div>
  );
}
