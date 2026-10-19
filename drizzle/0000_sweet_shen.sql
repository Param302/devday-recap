CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`artwork_id` text NOT NULL,
	`sort` integer NOT NULL,
	`source_card_id` text,
	`source_page_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_sort_unique` ON `pages` (`sort`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL,
	CONSTRAINT "positive_rate_count" CHECK("rate_limits"."count" > 0)
);
--> statement-breakpoint
CREATE INDEX `rate_limits_expiry` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`signature_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`resolved_by` text,
	`resolved_at` text,
	`resolution_note` text,
	FOREIGN KEY (`signature_id`) REFERENCES `signatures`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "report_status" CHECK("reports"."status" IN ('open','resolved','dismissed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_one_per_user_signature` ON `reports` (`signature_id`,`reporter_id`);--> statement-breakpoint
CREATE INDEX `reports_status_created` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `review_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`signature_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signatures` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`owner_id` text,
	`name` text NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`width` real NOT NULL,
	`height` real NOT NULL,
	`font` text NOT NULL,
	`ink` text NOT NULL,
	`socials` text NOT NULL,
	`status` text NOT NULL,
	`kind` text NOT NULL,
	`review_status` text NOT NULL,
	`source_card_id` text,
	`provenance` text NOT NULL,
	`consented_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`operation_id` text NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_card_id`) REFERENCES `source_cards`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "signature_status" CHECK("signatures"."status" IN ('pending','public','rejected','deleted')),
	CONSTRAINT "signature_kind" CHECK("signatures"."kind" IN ('visitor','event-card-import')),
	CONSTRAINT "signature_review" CHECK("signatures"."review_status" IN ('not-required','pending','approved','rejected')),
	CONSTRAINT "signature_style" CHECK("signatures"."font" IN ('caveat','dancing','kalam') AND "signatures"."ink" IN ('#252822','#355b93','#5f7143','#86516d')),
	CONSTRAINT "signature_bounds" CHECK("signatures"."x" >= 0 AND "signatures"."y" >= 0 AND "signatures"."width" > 0 AND "signatures"."height" > 0 AND "signatures"."x"+"signatures"."width" <= 1 AND "signatures"."y"+"signatures"."height" <= 1),
	CONSTRAINT "signature_json" CHECK(json_valid("signatures"."socials") AND json_valid("signatures"."provenance")),
	CONSTRAINT "import_source_required" CHECK("signatures"."kind" != 'event-card-import' OR "signatures"."source_card_id" IS NOT NULL),
	CONSTRAINT "review_before_public" CHECK("signatures"."status" != 'public' OR ("signatures"."kind" = 'visitor' AND "signatures"."consented_at" IS NOT NULL) OR ("signatures"."kind" = 'event-card-import' AND "signatures"."review_status" = 'approved' AND "signatures"."consented_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signatures_owner_idempotency` ON `signatures` (`owner_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `signatures_page_status` ON `signatures` (`page_id`,`status`);--> statement-breakpoint
CREATE INDEX `signatures_owner_status` ON `signatures` (`owner_id`,`status`);--> statement-breakpoint
CREATE TABLE `source_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`source_page_id` text NOT NULL,
	`image_asset_id` text NOT NULL,
	`image_sha256` text NOT NULL,
	`image_object_key` text NOT NULL,
	`captured_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "source_sha256_length" CHECK(length("source_cards"."image_sha256") = 64)
);
