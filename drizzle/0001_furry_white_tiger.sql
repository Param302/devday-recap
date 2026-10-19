ALTER TABLE `source_cards` ADD `physical_card_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `source_card_page_unique` ON `source_cards` (`physical_card_id`,`source_page_id`);