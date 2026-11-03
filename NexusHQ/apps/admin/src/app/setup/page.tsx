import { notFound } from "next/navigation";
import { connection } from "next/server";
import { HOSTED } from "@/lib/hosted";
import { readConfig } from "@nexushq/shared/config";
import SetupWizard from "@/components/SetupWizard";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_WORKER_EMAIL } from "@/lib/setup";

export const metadata = { title: "Setup" };

// First-run setup. The proxy sends every page here until a config exists; after that it is admin-only and can be
// re-run, e.g. to create the worker user or install new migrations.
export default async function SetupPage() {
  await connection();
  if (HOSTED) notFound(); // setup writes a local config file and installs migrations: home PC only

  const config = readConfig();
  if (config) await requireAdmin();
  return (
    <div className="login">
      <div className="card" style={{ width: "min(600px, 100%)" }}>
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">N</div>
          <div><b>NexusHQ</b><small>Setup</small></div>
        </div>
        <div>
          <h1 style={{ fontSize: 26 }}>{config ? "Re-run setup" : "Connect your Supabase project"}</h1>
          <p className="muted">
            {config
              ? "Checks the database, installs new migrations and resets the worker's sign-in. Existing data is kept."
              : "One-time setup: connects Supabase, installs the database, and creates your admin and worker accounts."}
          </p>
        </div>
        <SetupWizard
          rerun={!!config}
          defaults={{
            supabaseUrl: config?.supabaseUrl ?? "",
            publishableKey: config?.publishableKey ?? "",
            // The default worker address is always offered, so a re-run also fixes a worker account made on a personal email.
            workerEmail: DEFAULT_WORKER_EMAIL,
          }}
        />
      </div>
    </div>
  );
}
