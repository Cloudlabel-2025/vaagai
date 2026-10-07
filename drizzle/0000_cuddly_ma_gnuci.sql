CREATE TABLE `crew_records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`author` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_crew_kind_created` ON `crew_records` (`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_crew_author_kind` ON `crew_records` (`author`,`kind`);--> statement-breakpoint
CREATE TABLE `guide_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`author` text NOT NULL,
	`day` text NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
