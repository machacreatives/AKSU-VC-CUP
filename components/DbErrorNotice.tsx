import Link from "next/link";

/**
 * Shown when Postgres is unreachable or the tables do not exist yet, so the
 * site explains itself instead of throwing a Next.js error page.
 *
 * Both callers are **public** pages, so what this says in production matters.
 * It used to print the raw driver message in a `<pre>` to every visitor —
 * and Postgres errors carry table names, `relation "x" does not exist`,
 * `password authentication failed for user "..."`, and DNS failures containing
 * the database hostname. It also told a student on match day to add
 * POSTGRES_URL to a .env file and restart npm run dev.
 *
 * So the diagnosis is kept for development, where it is genuinely useful, and
 * production gets a sentence a spectator can act on. The detail is logged
 * server-side by the caller either way.
 */
export default function DbErrorNotice({ message }: { message?: string }) {
  const showDiagnosis = process.env.NODE_ENV !== "production" && Boolean(message);

  if (!showDiagnosis) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center lg:py-24">
        <h1 className="text-[18px] font-extrabold text-white lg:text-[20px]">
          Scores are temporarily unavailable
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-white/70">
          We can&apos;t reach the scores right now. This is usually brief — try again in a minute.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-[8px] bg-accent px-5 py-2.5 text-[13.5px] font-bold text-white transition-colors hover:bg-accent/90"
        >
          Try again
        </Link>
      </div>
    );
  }

  const detail = message ?? "";
  const notConfigured = /POSTGRES_URL|connection string|missing_connection_string/i.test(detail);
  const noTables = /relation .* does not exist/i.test(detail);

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 py-8">
      <h1 className="text-[17px] font-extrabold text-white">Database not ready</h1>
      <p className="text-[12px] font-bold uppercase tracking-wide text-gold">
        Development only — visitors see a plain &ldquo;temporarily unavailable&rdquo; message
      </p>
      {notConfigured ? (
        <p className="text-[14px] text-white">
          No Postgres connection string is set. Add <code className="text-accent">POSTGRES_URL</code> to your{" "}
          <code className="text-accent">.env</code> file (see <code className="text-accent">.env.example</code>) and
          restart <code className="text-accent">npm run dev</code>.
        </p>
      ) : noTables ? (
        <p className="text-[14px] text-white">
          The database is connected but the tables do not exist yet. Sign in at{" "}
          <Link href="/admin/login" className="font-bold text-accent">
            /admin/login
          </Link>{" "}
          and press <span className="font-bold">Update database</span>.
        </p>
      ) : (
        <p className="text-[14px] text-white">The site could not read from the database.</p>
      )}
      <pre className="overflow-x-auto rounded-card border border-line bg-surface p-3 text-[12px] text-white">
        {detail}
      </pre>
    </div>
  );
}
