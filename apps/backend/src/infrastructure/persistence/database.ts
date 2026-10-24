import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as schema from "./schema.js";
/** Construct the Drizzle database handle at the infrastructure boundary. */
export function createDatabase(pool: Pool): NodePgDatabase<typeof schema> {
  return drizzle(pool, { schema });
}
