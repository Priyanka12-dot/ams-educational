import argon2 from "argon2";
import pg from "pg";
const url = process.env.DATABASE_URL;
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const tenantName =
  process.env.SEED_TENANT_NAME ?? "Educational Practice Company";
if (!url || !email || !password || password.length < 12)
  throw new Error(
    "Set DATABASE_URL, SEED_ADMIN_EMAIL, and a SEED_ADMIN_PASSWORD of at least 12 characters.",
  );
const pool = new pg.Pool({ connectionString: url });
try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tenant = await client.query<{ id: string }>(
      "INSERT INTO tenants(name) VALUES($1) RETURNING id",
      [tenantName],
    );
    const tenantId = tenant.rows[0]!.id;
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    const user = await client.query<{ id: string }>(
      "INSERT INTO users(tenant_id,email,password_hash,role) VALUES($1,lower($2),$3,$4) RETURNING id",
      [tenantId, email, passwordHash, "ADMIN"],
    );
    const accounts = [
      ["1000", "Cash", "ASSET"],
      ["1100", "Accounts Receivable", "ASSET"],
      ["2000", "Accounts Payable", "LIABILITY"],
      ["3000", "Owner's Equity", "EQUITY"],
      ["4000", "Service Revenue", "REVENUE"],
      ["5000", "Supplies Expense", "EXPENSE"],
    ] as const;
    for (const [code, name, type] of accounts)
      await client.query(
        "INSERT INTO accounts(tenant_id,code,name,type) VALUES($1,$2,$3,$4)",
        [tenantId, code, name, type],
      );
    await client.query(
      "INSERT INTO audit_log(tenant_id,user_id,action,entity,metadata) VALUES($1,$2,$3,$4,$5)",
      [
        tenantId,
        user.rows[0]!.id,
        "SAMPLE_TENANT_SEEDED",
        "tenant",
        JSON.stringify({ accountCount: accounts.length }),
      ],
    );
    await client.query("COMMIT");
    console.log("Seeded sample tenant and chart of accounts.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
