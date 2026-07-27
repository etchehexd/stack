import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "../auth-form";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");

  const { error } = await props.searchParams;

  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <AuthForm mode="signin" initialError={typeof error === "string" ? error : undefined} />
    </div>
  );
}
