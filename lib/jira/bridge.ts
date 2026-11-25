const BRIDGE_URL = process.env.BRIDGE_URL ?? "http://localhost:3002";

export async function bridgeFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bridge ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
