import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./src/infrastructure/persistence/schema.ts",
  out: "./src/infrastructure/persistence/migrations/generated",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://placeholder" },
  strict: true,
  verbose: true,
});
