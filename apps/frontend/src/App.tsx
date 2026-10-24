import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./lib/api.js";
import { useSessionStore } from "./lib/session.js";
type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  active: boolean;
};
type Envelope<T> = { data: T };
export default function App() {
  const [tab, setTab] = useState("Accounts"),
    [message, setMessage] = useState("");
  const loggedIn = useSessionStore((s) => s.authenticated),
    setLoggedIn = useSessionStore((s) => s.setAuthenticated);
  const [auth, setAuth] = useState({ email: "", password: "", tenantName: "" });
  const [account, setAccount] = useState({
    code: "1000",
    name: "Cash",
    type: "ASSET",
  });
  const [entry, setEntry] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    description: "Opening balance",
    debit: "",
    credit: "",
    amount: "100.00",
  });
  const qc = useQueryClient();
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api<Envelope<Account[]>>("/accounts"),
    enabled: loggedIn,
  });
  const journals = useQuery({
    queryKey: ["journal"],
    queryFn: () =>
      api<
        Envelope<
          Array<{
            id: string;
            entryDate: string;
            description: string;
            status: string;
          }>
        >
      >("/journal-entries"),
    enabled: loggedIn,
  });
  const trial = useQuery({
    queryKey: ["trial"],
    queryFn: () =>
      api<
        Envelope<
          Array<{
            accountId: string;
            code: string;
            name: string;
            type: string;
            debit: string;
            credit: string;
          }>
        >
      >("/reports/trial-balance"),
    enabled: loggedIn,
  });
  const addAccount = useMutation({
    mutationFn: (v: object) =>
      api("/accounts", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
  useEffect(() => {
    void api("/auth/session")
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false));
  }, [setLoggedIn]);
  const addJournal = useMutation({
    mutationFn: (v: object) =>
      api("/journal-entries", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: () => {
      qc.invalidateQueries();
      setMessage("Balanced journal posted.");
    },
  });
  async function login(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: auth.email, password: auth.password }),
      });
      qc.clear();
      setLoggedIn(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sign-in failed");
    }
  }
  async function register() {
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(auth),
      });
      qc.clear();
      setLoggedIn(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Registration failed");
    }
  }
  if (!loggedIn)
    return (
      <main className="auth">
        <section className="card">
          <span className="eyebrow">LEARN ACCOUNTING BY DOING</span>
          <h1>AMS Educational</h1>
          <p>
            Practice double-entry bookkeeping with a real ledger and clear
            architecture.
          </p>
          <form onSubmit={login}>
            <label>
              Email
              <input
                type="email"
                required
                value={auth.email}
                onChange={(e) => setAuth({ ...auth, email: e.target.value })}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                minLength={12}
                required
                value={auth.password}
                onChange={(e) => setAuth({ ...auth, password: e.target.value })}
              />
            </label>
            <label>
              Organization name (for registration)
              <input
                value={auth.tenantName}
                onChange={(e) =>
                  setAuth({ ...auth, tenantName: e.target.value })
                }
              />
            </label>
            <div className="row">
              <button>Sign in</button>
              <button type="button" className="secondary" onClick={register}>
                Create organization
              </button>
            </div>
          </form>
          {message && <p role="alert">{message}</p>}
        </section>
      </main>
    );
  return (
    <div className="layout">
      <aside>
        <div className="brand">
          AMS<span>EDUCATIONAL</span>
        </div>
        <nav>
          {["Accounts", "Journal Entries", "Trial Balance"].map((x) => (
            <button
              className={tab === x ? "active" : ""}
              onClick={() => setTab(x)}
              key={x}
            >
              {x}
            </button>
          ))}
        </nav>
        <div className="aside-note">
          A learning ledger
          <br />
          built on double-entry rules.
        </div>
      </aside>
      <main className="content">
        <header>
          <div>
            <span className="eyebrow">ACCOUNTING WORKSPACE</span>
            <h1>{tab}</h1>
          </div>
          <button
            className="secondary"
            onClick={async () => {
              await api("/auth/logout", { method: "POST" });
              qc.clear();
              setLoggedIn(false);
            }}
          >
            Sign out
          </button>
        </header>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {tab === "Accounts" && (
          <>
            <section className="card">
              <h2>Create an account</h2>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  addAccount.mutate(account);
                }}
              >
                <input
                  aria-label="Code"
                  value={account.code}
                  onChange={(e) =>
                    setAccount({ ...account, code: e.target.value })
                  }
                />
                <input
                  aria-label="Name"
                  value={account.name}
                  onChange={(e) =>
                    setAccount({ ...account, name: e.target.value })
                  }
                />
                <select
                  value={account.type}
                  onChange={(e) =>
                    setAccount({ ...account, type: e.target.value })
                  }
                >
                  {["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
                <button>Create</button>
              </form>
            </section>
            <section className="card">
              <h2>Chart of accounts</h2>
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.data?.data.map((a) => (
                    <tr key={a.id}>
                      <td>{a.code}</td>
                      <td>{a.name}</td>
                      <td>{a.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
        {tab === "Journal Entries" && (
          <>
            <section className="card">
              <h2>Post a balanced journal entry</h2>
              <p className="help">
                Choose two accounts and enter the same positive amount on each
                side.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addJournal.mutate({
                    entryDate: entry.entryDate,
                    description: entry.description,
                    postings: [
                      {
                        accountId: entry.debit,
                        amount: entry.amount,
                        direction: "DEBIT",
                      },
                      {
                        accountId: entry.credit,
                        amount: entry.amount,
                        direction: "CREDIT",
                      },
                    ],
                  });
                }}
              >
                <div className="row">
                  <label>
                    Date
                    <input
                      type="date"
                      value={entry.entryDate}
                      onChange={(e) =>
                        setEntry({ ...entry, entryDate: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Description
                    <input
                      value={entry.description}
                      onChange={(e) =>
                        setEntry({ ...entry, description: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Amount
                    <input
                      inputMode="decimal"
                      value={entry.amount}
                      onChange={(e) =>
                        setEntry({ ...entry, amount: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="row">
                  <label>
                    Debit account
                    <select
                      required
                      value={entry.debit}
                      onChange={(e) =>
                        setEntry({ ...entry, debit: e.target.value })
                      }
                    >
                      <option value="">Select account</option>
                      {accounts.data?.data.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Credit account
                    <select
                      required
                      value={entry.credit}
                      onChange={(e) =>
                        setEntry({ ...entry, credit: e.target.value })
                      }
                    >
                      <option value="">Select account</option>
                      {accounts.data?.data.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button>Post journal</button>
              </form>
            </section>
            <section className="card">
              <h2>Recent entries</h2>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {journals.data?.data.map((j) => (
                    <tr key={j.id}>
                      <td>{j.entryDate}</td>
                      <td>{j.description}</td>
                      <td>{j.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
        {tab === "Trial Balance" && (
          <section className="card">
            <h2>Trial balance</h2>
            <p className="help">
              Every posted transaction has equal debits and credits.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {trial.data?.data.map((r) => (
                  <tr key={r.accountId}>
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td>{r.debit}</td>
                    <td>{r.credit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}
