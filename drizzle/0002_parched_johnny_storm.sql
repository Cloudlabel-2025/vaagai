CREATE TABLE `c310_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`rider` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_c310_rider_created` ON `c310_assessments` (`rider`,`created_at`);--> statement-breakpoint
CREATE TABLE `c310_models` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
