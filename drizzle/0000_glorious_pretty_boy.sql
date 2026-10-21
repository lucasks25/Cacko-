CREATE TABLE `crm_records` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE INDEX `crm_owner_type` ON `crm_records` (`owner`,`type`);