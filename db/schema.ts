import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const crewRecords = sqliteTable("crew_records", {
    id: text("id").primaryKey(), kind: text("kind").notNull(), author: text("author").notNull(), data: text("data").notNull(),
    createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(), revision: integer("revision").notNull().default(1),
}, t => [index("idx_crew_kind_created").on(t.kind, t.createdAt), index("idx_crew_author_kind").on(t.author, t.kind)]);
export const guideUsage = sqliteTable("guide_usage", {
    id: text("id").primaryKey(), author: text("author").notNull(), day: text("day").notNull(), used: integer("used").notNull().default(0),
});
export const growthWorkspace = sqliteTable('growth_workspace', {
    id:text('id').primaryKey(), data:text('data').notNull(), revision:integer('revision').notNull().default(1),
    updatedBy:text('updated_by').notNull(), updatedAt:text('updated_at').notNull(),
});
export const c310Models=sqliteTable('c310_models', {id:text('id').primaryKey(),data:text('data').notNull(),createdAt:text('created_at').notNull()});
export const c310Assessments=sqliteTable('c310_assessments', {id:text('id').primaryKey(),rider:text('rider').notNull(),data:text('data').notNull(),revision:integer('revision').notNull().default(1),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()},t=>[index('idx_c310_rider_created').on(t.rider,t.createdAt)]);
