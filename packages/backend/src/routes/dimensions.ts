import type { FastifyInstance } from "fastify";
import { createDimensionSchema, updateDimensionSchema } from "@progress-sheet/shared";
import { prisma } from "../db.js";
import { requireTenant } from "../auth.js";

export async function dimensionsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const auth = await requireTenant(request, reply);
    (request as { auth?: unknown }).auth = auth;
  });

  app.get("/dimensions", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const dimensions = await prisma.dimension.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { order: "asc" },
    });
    return { dimensions };
  });

  app.post("/dimensions", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const body = createDimensionSchema.parse(request.body);
    const dimension = await prisma.dimension.create({
      data: {
        tenantId: auth.tenantId,
        name: body.name,
        key: body.key,
        order: body.order ?? 0,
      },
    });
    return reply.status(201).send(dimension);
  });

  app.patch("/dimensions/:id", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { id } = request.params as { id: string };
    const dimension = await prisma.dimension.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!dimension) return reply.status(404).send({ error: "Dimensión no encontrada" });
    const body = updateDimensionSchema.parse(request.body);
    const updated = await prisma.dimension.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.order !== undefined && { order: body.order }),
      },
    });
    return reply.send(updated);
  });

  app.delete("/dimensions/:id", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { id } = request.params as { id: string };
    const dimension = await prisma.dimension.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!dimension) return reply.status(404).send({ error: "Dimensión no encontrada" });
    await prisma.dimension.delete({ where: { id } });
    return reply.status(204).send();
  });
}
