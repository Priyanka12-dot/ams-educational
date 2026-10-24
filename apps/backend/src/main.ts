import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import type fastifyCookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import * as argon2 from "argon2";
import pg from "pg";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { ZodError } from "zod";
import {
  createAccountSchema,
  createJournalEntrySchema,
  registerSchema,
} from "@ams/shared";
import { env } from "./infrastructure/config/env.js";
import { createContainer } from "./container.js";
import { DomainError } from "./domain/errors/DomainError.js";
const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  statement_timeout: 5000,
});
const container = createContainer(pool);
const app = Fastify({
  logger: true,
  trustProxy: env.NODE_ENV === "production",
  bodyLimit: 64 * 1024,
  requestTimeout: 15000,
  genReqId: () => randomUUID(),
});
const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
type Principal = {
  id: string;
  tenantId: string;
  role: "ADMIN" | "ACCOUNTANT" | "AUDITOR" | "VIEWER";
};
declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
    cookies: Record<string, string | undefined>;
  }
  interface FastifyReply {
    // @fastify/cookie declares this as a property; matching that shape avoids
    // conflicting with the plugin's declaration while preserving its types.
    setCookie: (
      name: string,
      value: string,
      options?: fastifyCookie.CookieSerializeOptions,
    ) => import("fastify").FastifyReply;
    clearCookie(name: string, options?: { path?: string }): this;
  }
}
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts:
    env.NODE_ENV === "production"
      ? { maxAge: 63072000, includeSubDomains: true }
      : false,
});
await app.register(cors, { origin: [env.FRONTEND_ORIGIN], credentials: true });
await app.register(cookie);
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
function sendError(error: unknown, requestId: string) {
  if (error instanceof ZodError)
    return {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request data is invalid.",
        requestId,
      },
    };
  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
      requestId,
    },
  };
}
app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error, requestId: request.id }, "Request failed");
  const status =
    error instanceof ZodError ? 400 : error instanceof DomainError ? 422 : 500;
  return reply.status(status).send(sendError(error, request.id));
});
app.addHook("onRequest", async (request, reply) => {
  reply.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  if (env.NODE_ENV === "production" && request.protocol !== "https")
    return reply.status(400).send({
      error: {
        code: "HTTPS_REQUIRED",
        message: "Secure transport required.",
        requestId: request.id,
      },
    });
});
app.addHook("preHandler", async (req, reply) => {
  if (
    (req.url.startsWith("/api/v1/auth/") &&
      req.url != "/api/v1/auth/session") ||
    req.url === "/health"
  )
    return;
  const token = req.cookies.ams_access;
  if (!token) {
    await reply.status(401).send({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
        requestId: req.id,
      },
    });
    return;
  }
  try {
    const verified = await jwtVerify(token, accessKey, {
      issuer: "ams-educational",
      audience: "ams-api",
    });
    const p = verified.payload as unknown as Principal;
    if (!p.id || !p.tenantId || !p.role) throw new Error("Invalid claims");
    req.principal = p;
  } catch {
    await reply.clearCookie("ams_access", { path: "/" });
    await reply.status(401).send({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
        requestId: req.id,
      },
    });
  }
});
const issueAccess = async (p: Principal) =>
  new SignJWT(p)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("ams-educational")
    .setAudience("ams-api")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessKey);
const cookieOptions = {
  httpOnly: true as const,
  secure: env.COOKIE_SECURE === "true",
  sameSite: "strict" as const,
  path: "/",
  priority: "high" as const,
};
app.get("/health", async () => ({ status: "ok" }));
app.get("/api/v1/auth/session", async (req) => ({
  user: { id: req.principal!.id, role: req.principal!.role },
  tenantId: req.principal!.tenantId,
}));
app.post(
  "/api/v1/auth/register",
  { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
  async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tenant = await client.query<{ id: string }>(
        "INSERT INTO tenants(name) VALUES($1) RETURNING id",
        [input.tenantName],
      );
      const tenantId = tenant.rows[0]!.id;
      const passwordHash = await argon2.hash(input.password, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
      const user = await client.query<{ id: string; role: Principal["role"] }>(
        "INSERT INTO users(tenant_id,email,password_hash,role) VALUES($1,lower($2),$3,$4) RETURNING id,role",
        [tenantId, input.email, passwordHash, "ADMIN"],
      );
      for (const [code, name, type] of [
        ["1000", "Cash", "ASSET"],
        ["1100", "Accounts Receivable", "ASSET"],
        ["2000", "Accounts Payable", "LIABILITY"],
        ["3000", "Owners Equity", "EQUITY"],
        ["4000", "Service Revenue", "REVENUE"],
        ["5000", "Supplies Expense", "EXPENSE"],
      ] as const)
        await client.query(
          "INSERT INTO accounts(tenant_id,code,name,type) VALUES($1,$2,$3,$4)",
          [tenantId, code, name, type],
        );
      await client.query(
        "INSERT INTO event_log(event_id,tenant_id,aggregate_id,event_type,payload,occurred_at) VALUES($1,$2,$3,$4,$5,now())",
        [
          randomUUID(),
          tenantId,
          user.rows[0]!.id,
          "UserRegistered",
          JSON.stringify({ role: "ADMIN" }),
        ],
      );
      await client.query(
        "INSERT INTO audit_log(tenant_id,user_id,action,entity,metadata) VALUES($1,$2,$3,$4,$5)",
        [
          tenantId,
          user.rows[0]!.id,
          "USER_REGISTERED",
          "user",
          JSON.stringify({}),
        ],
      );
      await client.query("COMMIT");
      const principal = {
        id: user.rows[0]!.id,
        tenantId,
        role: user.rows[0]!.role,
      };
      reply.setCookie("ams_access", await issueAccess(principal), {
        ...cookieOptions,
        maxAge: 900,
      });
      return reply
        .status(201)
        .send({ user: { id: principal.id, role: principal.role }, tenantId });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },
);
app.post(
  "/api/v1/auth/login",
  { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
  async (req, reply) => {
    const body = registerSchema
      .pick({ email: true, password: true })
      .strict()
      .parse(req.body);
    const result = await pool.query<{
      id: string;
      tenant_id: string;
      password_hash: string;
      role: Principal["role"];
      failed_login_count: number;
      locked_until: Date | null;
    }>(
      "SELECT id,tenant_id,password_hash,role,failed_login_count,locked_until FROM users WHERE lower(email)=lower($1) ORDER BY created_at LIMIT 1",
      [body.email],
    );
    const user = result.rows[0];
    if (
      !user ||
      (user.locked_until && user.locked_until > new Date()) ||
      !(await argon2
        .verify(
          user?.password_hash ??
            "$argon2id$v=19$m=19456,t=2,p=1$YWFhYWFhYWFhYWFhYWFhYQ$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          body.password,
        )
        .catch(() => false))
    ) {
      if (user) {
        const attempts = user.failed_login_count + 1;
        await pool.query(
          "UPDATE users SET failed_login_count=$1,locked_until=CASE WHEN $1>=8 THEN now()+interval '15 minutes' ELSE NULL END WHERE id=$2",
          [attempts, user.id],
        );
      }
      return reply.status(401).send({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
          requestId: req.id,
        },
      });
    }
    const principal = {
      id: user.id,
      tenantId: user.tenant_id,
      role: user.role,
    };
    await pool.query(
      "UPDATE users SET failed_login_count=0,locked_until=NULL WHERE id=$1",
      [user.id],
    );
    const raw = randomBytes(48).toString("base64url");
    await pool.query(
      "INSERT INTO refresh_tokens(tenant_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 days')",
      [user.tenant_id, user.id, tokenHash(raw)],
    );
    reply
      .setCookie("ams_access", await issueAccess(principal), {
        ...cookieOptions,
        maxAge: 900,
      })
      .setCookie("ams_refresh", raw, { ...cookieOptions, maxAge: 2592000 });
    await pool.query(
      "INSERT INTO audit_log(tenant_id,user_id,action,entity,metadata) VALUES($1,$2,$3,$4,$5)",
      [principal.tenantId, principal.id, "LOGIN", "user", JSON.stringify({})],
    );
    return {
      user: { id: principal.id, role: principal.role },
      tenantId: principal.tenantId,
    };
  },
);
app.post("/api/v1/auth/logout", async (req, reply) => {
  const raw = req.cookies.ams_refresh;
  if (raw)
    await pool.query(
      "UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL",
      [tokenHash(raw)],
    );
  reply
    .clearCookie("ams_access", { path: "/" })
    .clearCookie("ams_refresh", { path: "/" });
  return reply.status(204).send();
});
app.post("/api/v1/auth/refresh", async (req, reply) => {
  const raw = req.cookies.ams_refresh;
  if (!raw)
    return reply.status(401).send({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
        requestId: req.id,
      },
    });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{
      id: string;
      user_id: string;
      tenant_id: string;
      role: Principal["role"];
    }>(
      "SELECT rt.id, u.id AS user_id,u.tenant_id,u.role FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id WHERE rt.token_hash=$1 AND rt.revoked_at IS NULL AND rt.expires_at>now() FOR UPDATE",
      [tokenHash(raw)],
    );
    const row = current.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return reply.status(401).send({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required.",
          requestId: req.id,
        },
      });
    }
    const next = randomBytes(48).toString("base64url");
    const inserted = await client.query<{ id: string }>(
      "INSERT INTO refresh_tokens(tenant_id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 days') RETURNING id",
      [row.tenant_id, row.user_id, tokenHash(next)],
    );
    await client.query(
      "UPDATE refresh_tokens SET revoked_at=now(),replaced_by=$1 WHERE id=$2",
      [inserted.rows[0]!.id, row.id],
    );
    await client.query("COMMIT");
    const p = { id: row.user_id, tenantId: row.tenant_id, role: row.role };
    reply
      .setCookie("ams_access", await issueAccess(p), {
        ...cookieOptions,
        maxAge: 900,
      })
      .setCookie("ams_refresh", next, { ...cookieOptions, maxAge: 2592000 });
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});
app.get("/api/v1/accounts", async (req) => {
  const list = await container.accounts.list(req.principal!.tenantId);
  return {
    data: list.map((a) => ({
      id: a.id,
      code: a.code.value,
      name: a.name,
      type: a.type,
      parentId: a.parentId,
      active: a.active,
    })),
  };
});
app.post("/api/v1/accounts", async (req, reply) => {
  const p = req.principal!;
  if (!["ADMIN", "ACCOUNTANT"].includes(p.role))
    return reply.status(403).send({
      error: {
        code: "FORBIDDEN",
        message: "You do not have access to this action.",
        requestId: req.id,
      },
    });
  const input = createAccountSchema.parse(req.body);
  const account = await container.createAccount.execute(input, p);
  return reply.status(201).send({
    data: {
      id: account.id,
      code: account.code.value,
      name: account.name,
      type: account.type,
      parentId: account.parentId,
      active: account.active,
    },
  });
});
app.get<{ Params: { id: string } }>(
  "/api/v1/accounts/:id",
  async (req, reply) => {
    const account = await container.accounts.findById(
      req.principal!.tenantId,
      req.params.id,
    );
    if (!account)
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "Account not found.",
          requestId: req.id,
        },
      });
    return {
      data: {
        id: account.id,
        code: account.code.value,
        name: account.name,
        type: account.type,
        parentId: account.parentId,
        active: account.active,
      },
    };
  },
);
app.get<{ Params: { accountId: string } }>(
  "/api/v1/reports/ledger/:accountId",
  async (req) => ({
    data: await container.getAccountLedger.execute(
      req.principal!.tenantId,
      req.params.accountId,
    ),
  }),
);
app.post("/api/v1/journal-entries", async (req, reply) => {
  const p = req.principal!;
  if (!["ADMIN", "ACCOUNTANT"].includes(p.role))
    return reply.status(403).send({
      error: {
        code: "FORBIDDEN",
        message: "You do not have access to this action.",
        requestId: req.id,
      },
    });
  const input = createJournalEntrySchema.parse(req.body);
  const posted = await container.postJournalEntry.execute(input, p);
  return reply.status(201).send({
    data: {
      id: posted.id,
      status: posted.status,
      entryDate: posted.entryDate,
      description: posted.description,
    },
  });
});
app.get("/api/v1/journal-entries", async (req) => ({
  data: await container.listJournalEntries.execute(req.principal!.tenantId),
}));
app.get("/api/v1/reports/trial-balance", async (req) => {
  const rows = await container.generateTrialBalance.execute(
    req.principal!.tenantId,
  );
  return {
    data: rows.map((r) => ({
      accountId: r.accountId,
      code: r.code,
      name: r.name,
      type: r.type,
      debit: r.debit.toDecimal(),
      credit: r.credit.toDecimal(),
      net: r.net.toDecimal(),
    })),
  };
});
app.listen({ host: env.HOST, port: env.PORT });
