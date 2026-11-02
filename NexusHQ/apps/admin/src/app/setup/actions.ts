"use server";

import { readConfig } from "@nexushq/shared/config";
import { requireAdmin } from "@/lib/auth";
import { checkSetup, runSetup, type Connection, type SetupCheck, type SetupInput, type SetupStep } from "@/lib/setup";

// Before the first setup there is no Supabase and no admin to ask, so the wizard is open (the secret key it needs
// is the real proof of ownership). Once a config exists, only a signed-in admin may re-run it.
async function guard() {
  if (readConfig()) await requireAdmin();
}

export async function checkSetupAction(c: Connection): Promise<{ ok: true; check: SetupCheck } | { ok: false; error: string }> {
  await guard();
  try {
    return { ok: true, check: await checkSetup(c) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function runSetupAction(input: SetupInput): Promise<{ ok: boolean; steps: SetupStep[] }> {
  await guard();
  return runSetup(input);
}
