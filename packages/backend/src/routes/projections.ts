import type { FastifyInstance } from "fastify";
import { requireTenant } from "../auth.js";
import { prisma } from "../db.js";
import { getVelocityProjections } from "../projections/service.js";

export async function projectionsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const auth = await requireTenant(request, reply);
    (request as { auth?: unknown }).auth = auth;
  });

  app.get("/projects/:projectId/projections/velocity", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const query = request.query as { taskDefinitionId?: string; locationId?: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const projections = await getVelocityProjections(projectId, {
      taskDefinitionId: query.taskDefinitionId,
      locationId: query.locationId,
    });
    return { projections };
  });
}
