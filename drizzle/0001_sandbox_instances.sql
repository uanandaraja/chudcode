CREATE TABLE `sandbox_instances` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`sandbox_id` text NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`backup_id` text,
	`backup_dir` text,
	`started_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sandbox_instances_sandbox_id_unique` ON `sandbox_instances` (`sandbox_id`);
