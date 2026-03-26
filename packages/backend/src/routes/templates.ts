import type { FastifyInstance } from "fastify";
import { createTaskTemplateSchema } from "@progress-sheet/shared";
import { prisma } from "../db.js";
import { requireTenant } from "../auth.js";

export async function templatesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const auth = await requireTenant(request, reply);
    (request as { auth?: unknown }).auth = auth;
  });

  app.get("/templates", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const templates = await prisma.taskTemplate.findMany({
      where: { tenantId: auth.tenantId },
      include: { taskDefinitions: true },
    });
    return { templates };
  });

  app.post("/templates", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const body = createTaskTemplateSchema.parse(request.body);
    const template = await prisma.taskTemplate.create({
      data: { tenantId: auth.tenantId, name: body.name },
    });
    return reply.status(201).send(template);
  });

  app.get("/templates/:id", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { id } = request.params as { id: string };
    const template = await prisma.taskTemplate.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { taskDefinitions: true },
    });
    if (!template) return reply.status(404).send({ error: "Template not found" });
    return template;
  });
}
