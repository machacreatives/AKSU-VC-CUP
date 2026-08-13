import Link from "next/link";

// Shown when Postgres is unreachable or the tables have not been created yet,
// so the site explains itself instead of throwing a Next.js error page.
export default function DbErrorNotice({ message }: { message: string }) {
  const notConfigured = /POSTGRES_URL|connection string|missing_connection_string/i.test(message);
  const noTables = /relation .* does not exist/i.test(message);

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 py-8">
      <h1 className="text-[17px] font-extrabold text-white">Database not ready</h1>
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
          and press <span className="font-bold">Initialise database</span>.
        </p>
      ) : (
        <p className="text-[14px] text-white">The site could not read from the database.</p>
      )}
      <pre className="overflow-x-auto rounded-card border border-line bg-surface p-3 text-[12px] text-white">
        {message}
      </pre>
    </div>
  );
}
