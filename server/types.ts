import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
export type { D1Database };
export type ChatGPTUser = { userId: string };
export type ApiDependencies = {
  db: D1Database;
  // Bind the official server-only Sites getChatGPTUser helper here. Never derive
  // this value from browser JSON, bearer tokens, query parameters or raw headers.
  getChatGPTUser: () => Promise<ChatGPTUser | null>;
  chatGPTSignInPath: (returnTo: string) => string;
  moderatorUserIds: ReadonlySet<string>;
  artworkVerified: boolean;
  bucket?: R2Bucket;
  now?: () => number;
};
export type SignatureRow = {
  id: string;
  page_id: string;
  owner_id: string | null;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font: string;
  ink: string;
  socials: string;
  status: "pending" | "public" | "rejected" | "deleted";
  kind: "visitor" | "event-card-import";
  review_status: "not-required" | "pending" | "approved" | "rejected";
  source_card_id: string | null;
  provenance: string;
  consented_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  idempotency_key: string;
  request_hash: string;
  operation_id: string;
};
