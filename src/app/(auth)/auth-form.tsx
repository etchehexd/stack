"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { signIn, signUp, signInWithOAuth, type AuthFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";

const EMPTY: AuthFormState = {};

export function AuthForm({
  mode,
  initialError,
}: {
  mode: "signin" | "signup";
  initialError?: string;
}) {
  const isSignup = mode === "signup";
  const [state, formAction, pending] = useActionState(
    isSignup ? signUp : signIn,
    EMPTY,
  );

  const error = state.error ?? initialError;

  return (
    <GlassPanel radius="xl" className="w-full max-w-sm p-7">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isSignup ? "Create your Stack" : "Welcome back"}
      </h1>
      <p className="text-fg-3 mt-1.5 text-sm text-balance-pretty">
        {isSignup
          ? "Two ratings per title: how much you loved it, and how good it actually is."
          : "Pick up where you left off."}
      </p>

      <form action={formAction} className="mt-6 space-y-3">
        {isSignup && (
          <Field
            label="Username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="optional — we'll generate one"
            pattern="[a-zA-Z0-9_]{3,24}"
          />
        )}

        <Field
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />

        <Field
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isSignup ? "new-password" : "current-password"}
          placeholder="at least 8 characters"
        />

        {error && (
          <p
            role="alert"
            className="rounded-sm border border-[color-mix(in_oklch,var(--danger)_40%,transparent)] bg-[color-mix(in_oklch,var(--danger)_12%,transparent)] px-3 py-2 text-sm text-[var(--danger)]"
          >
            {error}
          </p>
        )}

        {state.message && (
          <p
            role="status"
            className="rounded-sm border border-[color-mix(in_oklch,var(--success)_40%,transparent)] bg-[color-mix(in_oklch,var(--success)_12%,transparent)] px-3 py-2 text-sm text-[var(--success)]"
          >
            {state.message}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={pending}
          className="w-full"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="border-hairline flex-1 border-t" />
        <span className="text-fg-3 text-xs">or</span>
        <span className="border-hairline flex-1 border-t" />
      </div>

      {/*
        These only work once you enable the provider in the Supabase dashboard
        (Authentication → Providers). Until then they'll return an error.
      */}
      <div className="space-y-2">
        <OAuthButton provider="google" label="Continue with Google" />
        <OAuthButton provider="discord" label="Continue with Discord" />
      </div>

      <p className="text-fg-3 mt-6 text-center text-sm">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="text-fg font-medium underline underline-offset-2"
        >
          {isSignup ? "Sign in" : "Create one"}
        </Link>
      </p>
    </GlassPanel>
  );
}

function OAuthButton({ provider, label }: { provider: string; label: string }) {
  return (
    <form action={signInWithOAuth}>
      <input type="hidden" name="provider" value={provider} />
      <Button type="submit" size="lg" className="w-full">
        {label}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentPropsWithoutRef<"input">) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="text-fg-2 mb-1.5 block text-xs font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="glass-subtle placeholder:text-fg-3 h-11 w-full rounded-md px-3.5 text-sm outline-none transition-[border-color,background] duration-200 focus:border-[var(--accent)]"
        {...props}
      />
    </div>
  );
}
