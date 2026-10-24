import { z } from "zod";
const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().default("0.0.0.0"),
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
    FRONTEND_ORIGIN: z.string().url(),
  })
  .superRefine((v, c) => {
    if (v.JWT_ACCESS_SECRET === v.JWT_REFRESH_SECRET)
      c.addIssue({ code: "custom", message: "JWT secrets must differ" });
    if (v.NODE_ENV === "production" && v.COOKIE_SECURE !== "true")
      c.addIssue({
        code: "custom",
        message: "Secure cookies required in production",
      });
  });
export const env = schema.parse(process.env);
