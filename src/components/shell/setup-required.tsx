import { GlassPanel } from "@/components/ui/glass-panel";

/**
 * Shown by the root layout when Supabase credentials are missing, in place of
 * the whole app. Previously this situation threw inside the layout, which
 * produced a bare "An error occurred in the Server Components render" on every
 * route — technically accurate, useless to act on.
 */
export function SetupRequired() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-5 py-16">
      <GlassPanel radius="xl" className="w-full p-7 sm:p-8">
        <p className="text-fg-3 text-xs font-medium tracking-wide uppercase">
          Stack
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          Supabase credentials are missing
        </h1>
        <p className="text-fg-2 mt-3 text-sm leading-relaxed">
          The app can&rsquo;t start without a database. It needs these two values,
          spelled exactly like this:
        </p>

        <ul className="mt-4 space-y-1.5">
          {["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].map((name) => (
            <li
              key={name}
              className="glass-subtle rounded-sm px-3 py-2 font-mono text-xs break-all"
            >
              {name}
            </li>
          ))}
        </ul>

        <div className="mt-6 space-y-5 text-sm">
          <section>
            <h2 className="font-medium">Running locally</h2>
            <p className="text-fg-2 mt-1.5 leading-relaxed">
              Put them in <code className="font-mono text-xs">.env.local</code>, then
              restart the dev server — it only reads that file at startup.
            </p>
            <pre className="glass-subtle mt-2 overflow-x-auto rounded-sm px-3 py-2 font-mono text-xs">
              npm run doctor
            </pre>
          </section>

          <section>
            <h2 className="font-medium">Deployed on Vercel</h2>
            <p className="text-fg-2 mt-1.5 leading-relaxed">
              Add them under <strong>Settings → Environment Variables</strong>, then{" "}
              <strong>redeploy</strong>. Changing variables does not affect an
              existing deployment — the values are baked in at build time.
            </p>
            <p className="text-fg-3 mt-2 text-xs leading-relaxed">
              If you used the Supabase integration, check the names it created. It
              sometimes writes <code className="font-mono">SUPABASE_URL</code> and{" "}
              <code className="font-mono">SUPABASE_ANON_KEY</code> without the{" "}
              <code className="font-mono">NEXT_PUBLIC_</code> prefix. The prefix is
              required — without it the values never reach the browser.
            </p>
          </section>
        </div>

        <p className="text-fg-3 border-hairline mt-6 border-t pt-4 text-xs">
          Full walkthrough in <code className="font-mono">MANUAL_SETUP.md</code>.
        </p>
      </GlassPanel>
    </main>
  );
}
