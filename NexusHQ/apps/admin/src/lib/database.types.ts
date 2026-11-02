// Generated from the Supabase project schema (supabase/migrations/20261019130000_portfolio_admin_schema.sql,
// 20261021130000_agent_settings_worker.sql).
// Regenerate after every migration: `supabase gen types typescript --project-id wcnqstqxvyualbneeopm`.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Status = Database["public"]["Enums"]["publish_status"];
type Kind = Database["public"]["Enums"]["testimonial_kind"];

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      agent_settings: Table<{
        agent: Database["public"]["Enums"]["agent_id"]; backend: string | null; base_url: string | null; fallback: Json | null;
        model: string; options: Json; provider: string; updated_at: string;
      }, "agent" | "provider">;
      articles: Table<{
        body_md: string; cover_path: string | null; created_at: string; id: string; published_on: string | null;
        read_minutes: number; slug: string; sort_order: number; status: Status; summary: string; title: string; updated_at: string;
      }, "slug" | "title">;
      cafe_panels: Table<{
        body: string; kicker: string; menu_label: string; object_name: string; sort_order: number; title: string;
        updated_at: string; zone: string;
      }, "object_name" | "zone">;
      job_runs: Table<{
        id: string; focus: string; status: string; counts: Json; log: string[]; error: string | null;
        started_at: string; finished_at: string | null;
      }, never>;
      jobs: Table<{
        id: string; upwork_id: string; run_id: string | null; title: string; url: string; summary: Json; detail: Json | null;
        stage: Database["public"]["Enums"]["job_stage"]; reason: string; score: number | null; rank: number | null;
        suggested_bid: Json | null; draft: Json | null; assessment: Json | null; found_at: string; updated_at: string;
      }, "upwork_id">;
      commands: Table<{
        claimed_at: string | null; created_at: string; created_by: string | null; error: string | null;
        finished_at: string | null; id: string; kind: string; payload: Json; result: Json | null;
        status: Database["public"]["Enums"]["command_status"];
      }, "kind">;
      contact_messages: Table<{
        created_at: string; email: string; id: string; message: string; name: string; read_at: string | null;
      }, "email" | "message" | "name">;
      education: Table<{
        certificate_path: string | null; created_at: string; id: string; org: string; sort_order: number; status: Status;
        subjects: string[]; title: string; updated_at: string; when_label: string;
      }, "title">;
      experiences: Table<{
        company: string; created_at: string; employment_type: string; end_label: string; highlights: string[]; id: string;
        logo_path: string | null; place: string; role: string; skills: string[]; slug: string; sort_order: number; start_label: string; status: Status;
        summary: string; updated_at: string;
      }, "role" | "slug">;
      gallery_photos: Table<{
        alt: string; caption: string; created_at: string; id: string; path: string; placement: string; sort_order: number;
        status: Status; updated_at: string;
      }, "path">;
      hobbies: Table<{
        body: string; created_at: string; details: string; id: string; photo_path: string | null; sort_order: number; status: Status;
        title: string; updated_at: string;
      }, "title">;
      model_credits: Table<{
        artist: string; created_at: string; id: string; license: string; model: string; sort_order: number; source_url: string;
      }, "artist" | "model">;
      open_source: Table<{
        badge: string; created_at: string; id: string; name: string; relation: string; sort_order: number; status: Status;
        summary: string; updated_at: string; url: string;
      }, "name">;
      profile: Table<{
        availability: string; avatar_path: string | null; contact_form_enabled: boolean; contact_headline: string;
        contact_lead: string; contact_reply: string; currently: string; email: string; headline: string; id: boolean;
        intro: string; location: string; name: string; principles: Json; resume_path: string | null; role: string;
        socials: Json; stack: string[]; stats: Json; story: string[]; updated_at: string; work_mode: string;
      }, never>;
      projects: Table<{
        built: string; category: string; cover_path: string | null; created_at: string; decisions: string[]; featured: boolean;
        id: string; kind: string; links: Json; media: Json; name: string; problem: string; quote_testimonial_id: string | null;
        results: string; role: string; skills: string[]; slug: string; sort_order: number; status: Status; summary: string;
        team: string; timeline: string; updated_at: string; year: string;
      }, "name" | "slug">;
      site_settings: Table<{
        cafe_door_neon: string; cafe_neon: string; cafe_neon_sub: string; cafe_what_i_do: string; cafe_window_neon: string;
        id: boolean; open_collection_enabled: boolean; updated_at: string;
      }, never>;
      skill_groups: Table<{
        created_at: string; id: string; skills: string[]; sort_order: number; status: Status; title: string; updated_at: string;
      }, "title">;
      testimonial_requests: Table<{
        allowed_kinds: Kind[]; client_name: string; created_at: string; email: string; expires_at: string; id: string;
        note: string; opened_at: string | null; project_id: string | null;
        status: Database["public"]["Enums"]["request_status"]; submitted_at: string | null;
      }, "client_name" | "email">;
      testimonials: Table<{
        avatar_path: string | null; consent: boolean; created_at: string; duration_s: number | null; id: string; kind: Kind;
        media_path: string | null; name: string; placements: string[]; poster_path: string | null; project_id: string | null;
        pull_quote: string; quote: string; rating: number | null; request_id: string | null; role: string; sort_order: number;
        source: Database["public"]["Enums"]["testimonial_source"]; state: Database["public"]["Enums"]["testimonial_state"];
        source_label: string; source_url: string | null; reviewed_on: string | null;
        transcript: string; trim_end_s: number | null; trim_start_s: number; updated_at: string;
      }, "name">;
      upwork_actions: Table<{
        action: string; created_at: string; current: string; error: string | null; id: string; kind: string; label: string;
        params: Json; preview: Json | null; preview_id: string | null; reason: string; result: Json | null; status: string; updated_at: string;
      }, "action" | "kind">;
      upwork_rooms: Table<{
        awaiting_reply_from: string; context: string; last_message_at: string | null; messages: Json; other_party: string;
        reply_draft: string; room_id: string; summary: string; synced_at: string; title: string; unread: boolean;
      }, "room_id">;
      upwork_snapshots: Table<{ brief: string; data: Json; fetched_at: string; kind: string }, "kind">;
      worker_status: Table<{
        hardware: Json; id: number; last_seen_at: string | null; providers: Json; started_at: string | null; tests: Json;
        mcp: Json; version: string; worker_name: string;
      }, never>;
    };
    Views: { [_ in never]: never };
    Functions: {
      agent_secret_status: { Args: never; Returns: { name: string; is_set: boolean; updated_at: string | null }[] };
      claim_next_command: { Args: never; Returns: Database["public"]["Tables"]["commands"]["Row"][] };
      get_agent_secrets: { Args: never; Returns: Json };
      set_agent_secret: { Args: { p_name: string; p_value: string }; Returns: undefined };
      is_admin: { Args: never; Returns: boolean };
      is_worker: { Args: never; Returns: boolean };
      open_testimonial_request: {
        Args: { p_token: string };
        Returns: { allowed_kinds: Kind[]; client_name: string; project_name: string }[];
      };
    };
    Enums: {
      agent_id: "filter" | "judge" | "writer" | "search" | "inbox" | "profile";
      job_stage: "found" | "gated_out" | "filtered_out" | "shortlisted" | "bid" | "skipped";
      command_status: "queued" | "running" | "done" | "error";
      publish_status: "published" | "draft" | "hidden";
      request_status: "sent" | "opened" | "submitted" | "expired";
      testimonial_kind: "text" | "video" | "audio";
      testimonial_source: "request" | "open" | "manual";
      testimonial_state: "pending" | "approved" | "rejected" | "archived";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type PublishStatus = Status;
export type TestimonialKind = Kind;
