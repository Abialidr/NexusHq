// Provider keys and cloud credentials the admin manages (Upwork cockpit → AI agents → API keys). Stored
// encrypted in Supabase Vault via set_agent_secret(); must match private.agent_secret_names() in
// supabase/migrations/20261021150000_agent_secrets_vault.sql.

export type SecretName =
  | "anthropic" | "openai" | "gemini" | "codex"
  | "aws_access_key_id" | "aws_secret_access_key" | "aws_session_token" | "aws_region" | "aws_bearer_token_bedrock"
  | "vertex_project" | "vertex_region";

export interface SecretDef {
  name: SecretName;
  label: string;
  group: string;
  secret: boolean;        // false = not sensitive (region, project id); shown as a plain text field
  placeholder?: string;
  hint?: string;
}

export const SECRETS: SecretDef[] = [
  { name: "anthropic", label: "Anthropic API key", group: "Anthropic", secret: true, placeholder: "sk-ant-…", hint: "Anthropic API provider and the Claude Code “API key” backend" },
  { name: "openai", label: "OpenAI API key", group: "OpenAI", secret: true, placeholder: "sk-…" },
  { name: "codex", label: "Codex API key", group: "OpenAI", secret: true, placeholder: "sk-…", hint: "Codex CLI “API key” backend (CODEX_API_KEY)" },
  { name: "gemini", label: "Gemini API key", group: "Google Gemini", secret: true, hint: "Gemini API cloud provider" },
  { name: "aws_region", label: "AWS region", group: "AWS Bedrock", secret: false, placeholder: "us-east-1" },
  { name: "aws_access_key_id", label: "Access key ID", group: "AWS Bedrock", secret: true, hint: "Leave empty to use the worker machine's AWS profile / SSO" },
  { name: "aws_secret_access_key", label: "Secret access key", group: "AWS Bedrock", secret: true },
  { name: "aws_session_token", label: "Session token", group: "AWS Bedrock", secret: true, hint: "Only for temporary credentials" },
  { name: "aws_bearer_token_bedrock", label: "Bedrock API key", group: "AWS Bedrock", secret: true, hint: "Alternative to access keys (Claude Code backend only)" },
  { name: "vertex_project", label: "GCP project ID", group: "Google Vertex / Agent Platform", secret: false, placeholder: "my-project" },
  { name: "vertex_region", label: "Region", group: "Google Vertex / Agent Platform", secret: false, placeholder: "global", hint: "Auth uses gcloud application-default credentials on the worker machine" },
];

export const SECRET_NAMES = SECRETS.map((s) => s.name);

export function isSecretName(v: unknown): v is SecretName {
  return typeof v === "string" && (SECRET_NAMES as string[]).includes(v);
}
