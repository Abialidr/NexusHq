// Hosted mode: the admin deployed on the web (e.g. Vercel) for checking results from your phone, while the worker
// runs on your home PC. Set NEXT_PUBLIC_NEXUSHQ_HOSTED=1 on the host. It hides the setup wizard, the AI agents page
// and every control that sends the worker a command; job lists, run logs, drafts and the portfolio data stay.
// NEXT_PUBLIC_ so the same flag works in server code and client components (inlined at build time).
export const HOSTED = process.env.NEXT_PUBLIC_NEXUSHQ_HOSTED === "1";

export const HOSTED_ONLY_LOCAL = "Not available on the hosted admin. Use the admin on the PC that runs the worker.";
