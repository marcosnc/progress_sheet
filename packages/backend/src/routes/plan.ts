import type { FastifyInstance } from "fastify";
import {
  createTaskDefinitionSchema,
  createTaskDependencySchema,
  updateTaskDefinitionSchema,
} from "@progress-sheet/shared";
import { prisma } from "../db.js";
import { requireTenant } from "../auth.js";
import { appendEvent } from "../event-store.js";

export async function planRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const auth = await requireTenant(request, reply);
    (request as { auth?: unknown }).auth = auth;
  });

  app.get("/projects/:projectId/plans", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const plans = await prisma.planVersion.findMany({
      where: { projectId },
      orderBy: { version: "desc" },
      include: { taskDefinitions: true },
    });
    return { plans };
  });

  app.post("/projects/:projectId/plans", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string; sub: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const lastVersion = await prisma.planVersion.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (lastVersion?.version ?? 0) + 1;
    const plan = await prisma.planVersion.create({
      data: {
        projectId,
        version,
        createdBy: auth.sub,
      },
    });
    await appendEvent({
      tenantId: auth.tenantId,
      projectId,
      type: "plan.created",
      userId: auth.sub,
      payload: { planVersionId: plan.id, version },
    });
    return reply.status(201).send(plan);
  });

  app.get("/projects/:projectId/plans/:planId", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId, planId } = request.params as { projectId: string; planId: string };
    const plan = await prisma.planVersion.findFirst({
      where: { id: planId, projectId, project: { tenantId: auth.tenantId } },
      include: {
        taskDefinitions: true,
        taskDependencies: true,
      },
    });
    if (!plan) return reply.status(404).send({ error: "Plan not found" });
    return plan;
  });

  app.post("/projects/:projectId/plans/:planId/tasks", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string; sub: string } }).auth!;
    const { projectId, planId } = request.params as { projectId: string; planId: string };
    const plan = await prisma.planVersion.findFirst({
      where: { id: planId, projectId, project: { tenantId: auth.tenantId } },
    });
    if (!plan) return reply.status(404).send({ error: "Plan not found" });
    const body = createTaskDefinitionSchema.parse(request.body);

    if (body.parentTaskDefinitionId) {
      const parent = await prisma.taskDefinition.findFirst({
        where: { id: body.parentTaskDefinitionId, planVersionId: planId },
        select: { id: true },
      });
      if (!parent) {
        return reply.status(400).send({ error: "parentTaskDefinitionId inválida para este plan" });
      }
    }

    const task = await prisma.taskDefinition.create({
      data: {
        planVersionId: planId,
        templateId: body.templateId ?? null,
        name: body.name,
        progressValueType: body.progressValueType,
        quantityUnit: body.quantityUnit ?? null,
        stateOptions: body.stateOptions ? JSON.stringify(body.stateOptions) : null,
        dimensionValues: body.dimensionValues ? JSON.stringify(body.dimensionValues) : null,
        parentTaskDefinitionId: body.parentTaskDefinitionId ?? null,
      },
    });
    await appendEvent({
      tenantId: auth.tenantId,
      projectId,
      type: "plan.task_added",
      userId: auth.sub,
      payload: {
        taskDefinitionId: task.id,
        name: task.name,
        progressValueType: task.progressValueType,
        quantityUnit: task.quantityUnit,
        stateOptions: body.stateOptions ?? null,
        dimensionValues: body.dimensionValues ?? null,
        templateId: task.templateId,
        parentTaskDefinitionId: body.parentTaskDefinitionId ?? null,
      },
    });
    return reply.status(201).send(task);
  });

  app.patch("/projects/:projectId/plans/:planId/tasks/:taskId", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId, planId, taskId } = request.params as { projectId: string; planId: string; taskId: string };
    const plan = await prisma.planVersion.findFirst({
      where: { id: planId, projectId, project: { tenantId: auth.tenantId } },
    });
    if (!plan) return reply.status(404).send({ error: "Plan not found" });
    const task = await prisma.taskDefinition.findFirst({
      where: { id: taskId, planVersionId: planId },
    });
    if (!task) return reply.status(404).send({ error: "Task not found" });
    const body = updateTaskDefinitionSchema.parse(request.body);

    if (body.parentTaskDefinitionId !== undefined) {
      if (body.parentTaskDefinitionId === taskId) {
        return reply.status(400).send({ error: "Una tarea no puede ser su propio padre" });
      }

      if (body.parentTaskDefinitionId) {
        const parent = await prisma.taskDefinition.findFirst({
          where: { id: body.parentTaskDefinitionId, planVersionId: planId },
          select: { id: true },
        });
        if (!parent) {
          return reply.status(400).send({ error: "parentTaskDefinitionId inválida para este plan" });
        }

        // Evitar ciclos: el padre no puede estar en el sub-árbol del task actual.
        const descendants = new Set<string>();
        let frontier: string[] = [taskId];
        for (let i = 0; i < 30 && frontier.length > 0; i++) {
          const children = await prisma.taskDefinition.findMany({
            where: { planVersionId: planId, parentTaskDefinitionId: { in: frontier } },
            select: { id: true },
          });
          frontier = children.map((c) => c.id);
          for (const c of children) descendants.add(c.id);
          if (descendants.has(body.parentTaskDefinitionId)) break;
        }
        if (descendants.has(body.parentTaskDefinitionId)) {
          return reply.status(400).send({ error: "La relación padre-hijo genera un ciclo" });
        }
      }
    }

    const updated = await prisma.taskDefinition.update({
      where: { id: taskId },
      data: {
        ...(body.name != null && { name: body.name }),
        ...(body.progressValueType != null && { progressValueType: body.progressValueType }),
        ...(body.quantityUnit !== undefined && { quantityUnit: body.quantityUnit }),
        ...(body.stateOptions !== undefined && { stateOptions: body.stateOptions ? JSON.stringify(body.stateOptions) : null }),
        ...(body.dimensionValues !== undefined && { dimensionValues: body.dimensionValues ? JSON.stringify(body.dimensionValues) : null }),
        ...(body.parentTaskDefinitionId !== undefined && {
          parentTaskDefinitionId: body.parentTaskDefinitionId ?? null,
        }),
      },
    });
    return updated;
  });

  app.delete("/projects/:projectId/plans/:planId/tasks/:taskId", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId, planId, taskId } = request.params as { projectId: string; planId: string; taskId: string };
    const plan = await prisma.planVersion.findFirst({
      where: { id: planId, projectId, project: { tenantId: auth.tenantId } },
    });
    if (!plan) return reply.status(404).send({ error: "Plan not found" });
    const task = await prisma.taskDefinition.findFirst({
      where: { id: taskId, planVersionId: planId },
      select: { id: true },
    });
    if (!task) return reply.status(404).send({ error: "Task not found" });

    // Limpiar referencias para evitar inconsistencias
    await prisma.locationTask.deleteMany({ where: { taskDefinitionId: taskId } });
    await prisma.progressSnapshot.deleteMany({ where: { projectId, taskDefinitionId: taskId } });
    await prisma.taskDependency.deleteMany({
      where: { planVersionId: planId, OR: [{ taskId }, { dependsOnTaskId: taskId }] },
    });

    // Dejar a los hijos sin padre (visual y referencial)
    await prisma.taskDefinition.updateMany({
      where: { planVersionId: planId, parentTaskDefinitionId: taskId },
      data: { parentTaskDefinitionId: null },
    });

    await prisma.taskDefinition.delete({ where: { id: taskId } });
    return reply.status(204).send();
  });

  app.post("/projects/:projectId/plans/:planId/dependencies", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId, planId } = request.params as { projectId: string; planId: string };
    const plan = await prisma.planVersion.findFirst({
      where: { id: planId, projectId, project: { tenantId: auth.tenantId } },
    });
    if (!plan) return reply.status(404).send({ error: "Plan not found" });
    const body = createTaskDependencySchema.parse(request.body);
    const dep = await prisma.taskDependency.create({
      data: {
        planVersionId: planId,
        taskId: body.taskId,
        dependsOnTaskId: body.dependsOnTaskId,
      },
    });
    return reply.status(201).send(dep);
  });

  app.delete("/projects/:projectId/plans/:planId/dependencies/:depId", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId, planId, depId } = request.params as {
      projectId: string;
      planId: string;
      depId: string;
    };
    const plan = await prisma.planVersion.findFirst({
      where: { id: planId, projectId, project: { tenantId: auth.tenantId } },
    });
    if (!plan) return reply.status(404).send({ error: "Plan not found" });
    await prisma.taskDependency.deleteMany({
      where: { id: depId, planVersionId: planId },
    });
    return reply.status(204).send();
  });
}
