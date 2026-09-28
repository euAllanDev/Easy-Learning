DROP INDEX "availabilities_user_idx";--> statement-breakpoint
ALTER TABLE "availability_slots" ALTER COLUMN "day_of_week" SET DATA TYPE integer USING "day_of_week"::integer;--> statement-breakpoint
CREATE UNIQUE INDEX "availabilities_user_unique" ON "availabilities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "availability_slots_order_idx" ON "availability_slots" USING btree ("user_id","day_of_week","start_time");
