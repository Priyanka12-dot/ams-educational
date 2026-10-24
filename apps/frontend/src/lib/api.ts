const base =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://localhost:3000/api/v1" : "/api/v1");
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const request = () =>
    fetch(base + path, {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...init.headers },
    });
  let response = await request();
  if (
    response.status === 401 &&
    ![
      "/auth/login",
      "/auth/register",
      "/auth/logout",
      "/auth/refresh",
    ].includes(path)
  ) {
    const refreshed = await fetch(base + "/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (refreshed.ok) response = await request();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Request failed");
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
