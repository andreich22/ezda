import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  boolean,
  timestamp,
  index,
  customType,
} from "drizzle-orm/pg-core";

const geography = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return "gis.geography(LineString,4326)";
  },
});

export const routes = pgTable(
  "routes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    geometry: geography("geometry").notNull(),
    distanceMeters: doublePrecision("distance_meters").notNull(),
    elevationGainMeters: doublePrecision("elevation_gain_meters"),
    durationSeconds: doublePrecision("duration_seconds"),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    geometryIdx: index("routes_geometry_gist_idx").using("gist", table.geometry),
  }),
);
