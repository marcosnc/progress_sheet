import type { FastifyInstance } from "fastify";
import { createProjectSchema } from "@progress-sheet/shared";
import { prisma } from "../db.js";
import { requireTenant } from "../auth.js";

export async function projectsRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const auth = await requireTenant(request, reply);
    const projects = await prisma.project.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { updatedAt: "desc" },
    });
    return { projects };
  });

  app.get("/:id", async (request, reply) => {
    const auth = await requireTenant(request, reply);
    const { id } = request.params as { id: string };
    const project = await prisma.project.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        locations: true,
        planVersions: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    return project;
  });

  app.post("/", async (request, reply) => {
    const auth = await requireTenant(request, reply);
    const body = createProjectSchema.parse(request.body);
    const project = await prisma.project.create({
      data: {
        tenantId: auth.tenantId,
        name: body.name,
      },
    });
    return reply.status(201).send(project);
  });

  app.patch("/:id", async (request, reply) => {
    const auth = await requireTenant(request, reply);
    const { id } = request.params as { id: string };
    const body = createProjectSchema.partial().parse(request.body);
    const project = await prisma.project.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const updated = await prisma.project.update({
      where: { id },
      data: body,
    });
    return updated;
  });

  app.delete("/:id", async (request, reply) => {
    const auth = await requireTenant(request, reply);
    const { id } = request.params as { id: string };
    const project = await prisma.project.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    await prisma.project.delete({ where: { id } });
    return reply.status(204).send();
  });
}
