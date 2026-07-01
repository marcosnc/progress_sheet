import type { StoredImportSession } from "./types.js";

const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map<string, StoredImportSession>();

export function storeImportSession(session: StoredImportSession): string {
  const id = crypto.randomUUID();
  sessions.set(id, session);
  return id;
}

export function getImportSession(sessionId: string): StoredImportSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.createdAt.getTime() > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

export function deleteImportSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function clearExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt.getTime() > SESSION_TTL_MS) sessions.delete(id);
  }
}
