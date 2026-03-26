import type { FastifyInstance } from "fastify";
import { createLocationLevelSchema, updateLocationLevelSchema } from "@progress-sheet/shared";
import { prisma } from "../db.js";
import { requireTenant } from "../auth.js";

export async function locationLevelsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const auth = await requireTenant(request, reply);
    (request as { auth?: unknown }).auth = auth;
  });

  app.get("/location-levels", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const levels = await prisma.locationLevel.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { order: "asc" },
    });
    return { levels };
  });

  app.post("/location-levels", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const body = createLocationLevelSchema.parse(request.body);
    const level = await prisma.locationLevel.create({
      data: {
        tenantId: auth.tenantId,
        name: body.name,
        order: body.order,
      },
    });
    return reply.status(201).send(level);
  });

  app.patch("/location-levels/:id", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { id } = request.params as { id: string };
    const level = await prisma.locationLevel.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!level) return reply.status(404).send({ error: "Nivel no encontrado" });
    const body = updateLocationLevelSchema.parse(request.body);
    const updated = await prisma.locationLevel.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.order !== undefined && { order: body.order }),
      },
    });
    return reply.send(updated);
  });

  app.delete("/location-levels/:id", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { id } = request.params as { id: string };
    const level = await prisma.locationLevel.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!level) return reply.status(404).send({ error: "Nivel no encontrado" });
    const inUse = await prisma.location.count({ where: { levelId: id } });
    if (inUse > 0) {
      return reply.status(400).send({ error: `No se puede borrar: ${inUse} ubicación(es) usan este nivel` });
    }
    await prisma.locationLevel.delete({ where: { id } });
    return reply.status(204).send();
  });
}
