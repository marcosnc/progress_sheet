import type { FastifyInstance } from "fastify";
import { loginSchema } from "@progress-sheet/shared";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: {
        tenantMembers: { take: 1, orderBy: { id: "asc" } },
      },
    });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }
    const member = user.tenantMembers[0];
    const token = app.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        tenantId: member?.tenantId,
        role: member?.role ?? "viewer",
      },
      { expiresIn: "7d" }
    );
    return { token, userId: user.id, tenantId: member?.tenantId, role: member?.role };
  });
}
