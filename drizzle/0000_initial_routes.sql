CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"geometry" text NOT NULL,
	"distance_meters" double precision NOT NULL,
	"elevation_gain_meters" double precision,
	"duration_seconds" double precision,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
