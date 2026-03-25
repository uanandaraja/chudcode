import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sandboxInstancesTable = sqliteTable(
  "sandbox_instances",
  {
    workspaceId: text("workspace_id").primaryKey(),
    sandboxId: text("sandbox_id").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(false),
    backupId: text("backup_id"),
    backupDir: text("backup_dir"),
    startedAt: text("started_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("sandbox_instances_sandbox_id_unique").on(table.sandboxId)],
);
