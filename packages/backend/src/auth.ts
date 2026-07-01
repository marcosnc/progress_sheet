import type { FastifyRequest, FastifyReply } from "fastify";

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  role?: string;
}

export function getAuth(request: FastifyRequest): JwtPayload | null {
  try {
    const payload = request.user as JwtPayload;
    return payload ?? null;
  } catch {
    return null;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<JwtPayload> {
  const auth = getAuth(request);
  if (!auth) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  return auth;
}

export async function requireTenant(request: FastifyRequest, reply: FastifyReply): Promise<JwtPayload & { tenantId: string }> {
  const auth = await requireAuth(request, reply);
  const tenantId = (auth as { tenantId?: string }).tenantId ?? (request.headers["x-tenant-id"] as string);
  if (!tenantId) {
    return reply.status(403).send({ error: "Tenant required" });
  }
  return { ...auth, tenantId };
}

export async function requirePlanner(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<JwtPayload & { tenantId: string }> {
  const auth = await requireTenant(request, reply);
  if (auth.role !== "planner") {
    reply.status(403).send({ error: "Se requiere rol planner" });
    throw new Error("Forbidden");
  }
  return auth;
}
