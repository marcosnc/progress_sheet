import type { FastifyInstance } from "fastify";
import { recordProgressSchema, recordProgressBatchSchema } from "@progress-sheet/shared";
import { appendEvent } from "../event-store.js";
import { requireTenant } from "../auth.js";
import { prisma } from "../db.js";
import { computeProgressState, getProgressAggregated } from "../aggregation/engine.js";

export async function progressRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const auth = await requireTenant(request, reply);
    (request as { auth?: unknown }).auth = auth;
  });

  app.post("/projects/:projectId/progress", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string; sub: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const body = recordProgressSchema.parse(request.body);
    const task = await prisma.taskDefinition.findFirst({
      where: { id: body.taskDefinitionId },
      include: { planVersion: true },
    });
    if (!task || task.planVersion.projectId !== projectId) {
      return reply.status(404).send({ error: "Task not found" });
    }
    const location = await prisma.location.findFirst({
      where: { id: body.locationId, projectId },
    });
    if (!location) return reply.status(404).send({ error: "Location not found" });
    const locationTask = await prisma.locationTask.findUnique({
      where: {
        locationId_taskDefinitionId: { locationId: body.locationId, taskDefinitionId: body.taskDefinitionId },
      },
    });
    if (!locationTask) {
      return reply.status(400).send({
        error: "La tarea no está asociada a esta ubicación. Asociá la tarea a la ubicación en el plan (Ubicaciones).",
      });
    }

    const eventId = await appendEvent({
      tenantId: auth.tenantId,
      projectId,
      type: "progress.recorded",
      userId: auth.sub,
      payload: {
        taskDefinitionId: body.taskDefinitionId,
        locationId: body.locationId,
        value: body.value,
        delta: body.delta,
      },
    });
    return reply.status(201).send({ id: eventId });
  });

  app.post("/projects/:projectId/progress/batch", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string; sub: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const body = recordProgressBatchSchema.parse(request.body);
    const ids: string[] = [];
    for (const ev of body.events) {
      const task = await prisma.taskDefinition.findFirst({
        where: { id: ev.taskDefinitionId },
        include: { planVersion: true },
      });
      if (!task || task.planVersion.projectId !== projectId) continue;
      const location = await prisma.location.findFirst({
        where: { id: ev.locationId, projectId },
      });
      if (!location) continue;
      const locationTask = await prisma.locationTask.findUnique({
        where: {
          locationId_taskDefinitionId: { locationId: ev.locationId, taskDefinitionId: ev.taskDefinitionId },
        },
      });
      if (!locationTask) continue;
      const eventId = await appendEvent({
        tenantId: auth.tenantId,
        projectId,
        type: "progress.recorded",
        userId: auth.sub,
        payload: {
          taskDefinitionId: ev.taskDefinitionId,
          locationId: ev.locationId,
          value: ev.value,
          delta: ev.delta,
        },
      });
      ids.push(eventId);
    }
    return reply.status(201).send({ ids });
  });

  app.get("/projects/:projectId/progress", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const query = request.query as {
      groupBy?: "task" | "location" | "none";
      taskDefinitionId?: string;
      locationId?: string;
      locationPathPrefix?: string;
    };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const groupBy = query.groupBy ?? "none";
    const aggregated = await getProgressAggregated(projectId, groupBy, {
      taskDefinitionId: query.taskDefinitionId,
      locationId: query.locationId,
      locationPathPrefix: query.locationPathPrefix,
    });
    return aggregated;
  });

  app.get("/projects/:projectId/progress/state", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const state = await computeProgressState(projectId, { persist: false });
    const items = Array.from(state.values());
    return { items };
  });
}
