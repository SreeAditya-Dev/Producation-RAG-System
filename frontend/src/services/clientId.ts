const STORAGE_KEY = 'rag_client_id';

/**
 * Per-tab identity used to scope WebSocket pipeline events to the tab that
 * actually issued the request (upload/query) — the backend only ever
 * broadcasts telemetry back to the client_id that triggered it, never to
 * every connected socket. Persisted in sessionStorage so it's stable across
 * reconnects within a tab, but distinct per tab/window.
 */
export function getClientId(): string {
  let id = sessionStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
