import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("auth_sessions_token_unique").on(table.tokenHash), index("auth_sessions_user_idx").on(table.userId)]);

export const studentProfiles = pgTable("student_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  preferredStudyPeriod: text("preferred_study_period").default("FLEXIBLE").notNull(),
  preferredSessionMinutes: integer("preferred_session_minutes"),
  preferredBreakMinutes: integer("preferred_break_minutes"),
  ...timestamps,
}, (table) => [uniqueIndex("student_profiles_user_unique").on(table.userId)]);

export const goals = pgTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").default("").notNull(),
  priority: text("priority").default("MEDIUM").notNull(),
  idealMinutesPerDay: integer("ideal_minutes_per_day").notNull(),
  minimumMinutesPerDay: integer("minimum_minutes_per_day").notNull(),
  status: text("status").default("ACTIVE").notNull(),
  ...timestamps,
}, (table) => [index("goals_user_idx").on(table.userId)]);

export const goalAreas = pgTable("goal_areas", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").default("").notNull(),
  ...timestamps,
}, (table) => [index("goal_areas_owner_idx").on(table.userId, table.goalId)]);

export const topics = pgTable("topics", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  areaId: uuid("area_id").notNull().references(() => goalAreas.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").default("").notNull(),
  ...timestamps,
}, (table) => [index("topics_owner_idx").on(table.userId, table.areaId)]);

export const availabilities = pgTable("availabilities", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").default("Rotina semanal").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("availabilities_user_unique").on(table.userId)]);

export const availabilitySlots = pgTable("availability_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  availabilityId: uuid("availability_id").notNull().references(() => availabilities.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  ...timestamps,
}, (table) => [
  index("availability_slots_owner_idx").on(table.userId, table.availabilityId),
  index("availability_slots_order_idx").on(table.userId, table.dayOfWeek, table.startTime),
  check("availability_slots_day_check", sql`${table.dayOfWeek} between 0 and 6`),
  check("availability_slots_interval_check", sql`${table.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and ${table.endTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and ${table.startTime} < ${table.endTime}`),
]);

export const studySessions = pgTable("study_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
  areaId: uuid("area_id").references(() => goalAreas.id, { onDelete: "set null" }),
  topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
  title: text("title"),
  clientId: text("client_id"),
  plannedStart: timestamp("planned_start", { withTimezone: true }).notNull(),
  plannedEnd: timestamp("planned_end", { withTimezone: true }).notNull(),
  plannedDuration: integer("planned_duration").notNull(),
  actualDuration: integer("actual_duration"),
  status: text("status").default("PLANNED").notNull(),
  source: text("source").default("ROUTINE").notNull(),
  difficulty: text("difficulty"),
  questions: integer("questions"),
  correctAnswers: integer("correct_answers"),
  accuracy: numeric("accuracy", { precision: 5, scale: 2, mode: "number" }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  resumedAt: timestamp("resumed_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  focusedSeconds: integer("focused_seconds").default(0).notNull(),
  pausedSeconds: integer("paused_seconds").default(0).notNull(),
  version: integer("version").default(1).notNull(),
  note: text("note"),
  ...timestamps,
}, (table) => [
  index("study_sessions_user_start_idx").on(table.userId, table.plannedStart),
  uniqueIndex("study_sessions_client_unique").on(table.userId, table.clientId),
  uniqueIndex("study_sessions_one_active_per_user").on(table.userId).where(sql`${table.status} in ('IN_PROGRESS', 'PAUSED')`),
  check("study_sessions_status_check", sql`${table.status} in ('PLANNED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'SKIPPED', 'CANCELLED')`),
  check("study_sessions_source_check", sql`${table.source} in ('ROUTINE', 'MANUAL')`),
  check("study_sessions_difficulty_check", sql`${table.difficulty} is null or ${table.difficulty} in ('EASY', 'NORMAL', 'HARD')`),
  check("study_sessions_planned_interval_check", sql`${table.plannedEnd} > ${table.plannedStart} and ${table.plannedDuration} > 0`),
  check("study_sessions_result_check", sql`(${table.actualDuration} is null or ${table.actualDuration} >= 0) and (${table.questions} is null or ${table.questions} >= 0) and (${table.correctAnswers} is null or ${table.correctAnswers} >= 0) and (${table.questions} is null or ${table.correctAnswers} is null or ${table.correctAnswers} <= ${table.questions})`),
]);

export const pomodoroCycles = pgTable("pomodoro_cycles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => studySessions.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  kind: text("kind").notNull(),
  plannedDuration: integer("planned_duration").notNull(),
  actualDuration: integer("actual_duration"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("pomodoro_cycle_sequence_unique").on(table.userId, table.sessionId, table.sequence)]);

export const weeklyReviews = pgTable("weekly_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
  weekEnd: timestamp("week_end", { withTimezone: true }).notNull(),
  feeling: text("feeling").notNull(),
  notes: text("notes"),
  ...timestamps,
}, (table) => [uniqueIndex("weekly_reviews_user_week_unique").on(table.userId, table.weekStart)]);

export const studyPreferences = pgTable("study_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  focusDuration: integer("focus_duration").default(25).notNull(),
  shortBreakDuration: integer("short_break_duration").default(5).notNull(),
  longBreakDuration: integer("long_break_duration").default(15).notNull(),
  cycles: integer("cycles").default(4).notNull(),
  coachEnabled: boolean("coach_enabled").default(true).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("study_preferences_user_unique").on(table.userId)]);

export const coachRecommendations = pgTable("coach_recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  reason: text("reason").notNull(),
  confidence: text("confidence").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").default("PENDING").notNull(),
  ...timestamps,
}, (table) => [index("coach_recommendations_user_idx").on(table.userId)]);

export const coachDecisions = pgTable("coach_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recommendationId: uuid("recommendation_id").notNull().references(() => coachRecommendations.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("coach_decisions_recommendation_unique").on(table.userId, table.recommendationId)]);
