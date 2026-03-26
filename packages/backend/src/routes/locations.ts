import type { FastifyInstance } from "fastify";
import { createLocationSchema, replicateLocationsSchema, replicateFromLocationSchema, updateLocationSchema } from "@progress-sheet/shared";
import { prisma } from "../db.js";
import { requireTenant } from "../auth.js";

function buildPath(parentPath: string | null, segment: string): string {
  return parentPath ? `${parentPath}/${segment}` : segment;
}

export async function locationsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const auth = await requireTenant(request, reply);
    (request as { auth?: unknown }).auth = auth;
  });

  app.get("/projects/:projectId/locations", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const locations = await prisma.location.findMany({
      where: { projectId },
      orderBy: { path: "asc" },
      include: { locationTasks: true },
    });
    const result = locations.map((loc) => ({
      ...loc,
      taskDefinitionIds: loc.locationTasks.map((lt) => lt.taskDefinitionId),
      taskAssignments: loc.locationTasks.map((lt) => ({
        taskDefinitionId: lt.taskDefinitionId,
        totalQuantity: ((lt as unknown as { totalQuantity?: number | null }).totalQuantity ?? null),
      })),
      locationTasks: undefined,
    }));
    return { locations: result };
  });

  app.post("/projects/:projectId/locations", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const body = createLocationSchema.parse({ ...(request.body as object), projectId });
    const segment = body.name.replace(/\//g, "-").toLowerCase().replace(/\s+/g, "-");
    let path: string;
    if (body.parentId) {
      const parent = await prisma.location.findFirst({
        where: { id: body.parentId, projectId },
      });
      if (!parent) return reply.status(404).send({ error: "Parent location not found" });
      path = buildPath(parent.path, segment);
    } else {
      path = segment;
    }
    const location = await prisma.location.create({
      data: {
        projectId,
        parentId: body.parentId,
        levelId: body.levelId,
        name: body.name,
        path,
      },
    });
    if (body.taskDefinitionIds?.length) {
      const validTaskIds = await prisma.taskDefinition.findMany({
        where: {
          id: { in: body.taskDefinitionIds },
          planVersion: { projectId },
        },
        select: { id: true },
      });
      const ids = validTaskIds.map((t) => t.id);
      await prisma.locationTask.createMany({
        data: ids.map((taskDefinitionId) => ({ locationId: location.id, taskDefinitionId })),
        skipDuplicates: true,
      });
    }
    const withTasks = await prisma.location.findUnique({
      where: { id: location.id },
      include: { locationTasks: true },
    });
    return reply.status(201).send({
      ...withTasks,
      taskDefinitionIds: withTasks!.locationTasks.map((lt) => lt.taskDefinitionId),
      taskAssignments: withTasks!.locationTasks.map((lt) => ({
        taskDefinitionId: lt.taskDefinitionId,
        totalQuantity: ((lt as unknown as { totalQuantity?: number | null }).totalQuantity ?? null),
      })),
      locationTasks: undefined,
    });
  });

  app.post("/projects/:projectId/locations/replicate", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const body = replicateLocationsSchema.parse(request.body);
    const prefix = body.namePrefix ?? "Item";
    let parentPath: string | null = null;
    if (body.parentId) {
      const parent = await prisma.location.findFirst({
        where: { id: body.parentId, projectId },
      });
      if (!parent) return reply.status(404).send({ error: "Parent location not found" });
      parentPath = parent.path;
    }
    let validTaskIds: string[] = [];
    if (body.taskDefinitionIds?.length) {
      const tasks = await prisma.taskDefinition.findMany({
        where: {
          id: { in: body.taskDefinitionIds },
          planVersion: { projectId },
        },
        select: { id: true },
      });
      validTaskIds = tasks.map((t) => t.id);
    }
    const created: { id: string; name: string; path: string; taskDefinitionIds: string[] }[] = [];
    for (let i = 1; i <= body.count; i++) {
      const name = `${prefix} ${i}`;
      const segment = name.replace(/\//g, "-").toLowerCase().replace(/\s+/g, "-");
      const path = buildPath(parentPath, segment);
      const location = await prisma.location.create({
        data: {
          projectId,
          parentId: body.parentId,
          levelId: body.levelId,
          name,
          path,
        },
      });
      if (validTaskIds.length) {
        await prisma.locationTask.createMany({
          data: validTaskIds.map((taskDefinitionId) => ({ locationId: location.id, taskDefinitionId })),
          skipDuplicates: true,
        });
      }
      created.push({
        id: location.id,
        name: location.name,
        path: location.path,
        taskDefinitionIds: validTaskIds,
      });
    }
    return reply.status(201).send({ locations: created });
  });

  app.patch("/projects/:projectId/locations/:locationId", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId, locationId } = request.params as { projectId: string; locationId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const location = await prisma.location.findFirst({
      where: { id: locationId, projectId },
    });
    if (!location) return reply.status(404).send({ error: "Location not found" });
    const body = updateLocationSchema.parse(request.body);

    // Cambios que afectan al path: nombre y/o padre.
    if (body.parentId !== undefined || body.name !== undefined) {
      if (body.parentId === locationId) {
        return reply.status(400).send({ error: "Una ubicación no puede ser su propio padre" });
      }

      const desiredName = body.name ?? location.name;
      const desiredParentId = body.parentId !== undefined ? body.parentId : (location.parentId ?? null);

      const segment = desiredName.replace(/\//g, "-").toLowerCase().replace(/\s+/g, "-");
      const oldPath = location.path;

      let parentPath: string | null = null;
      if (desiredParentId) {
        const parent = await prisma.location.findFirst({
          where: { id: desiredParentId, projectId },
          select: { id: true, path: true },
        });
        if (!parent) return reply.status(400).send({ error: "Parent location not found" });

        // Evitar ciclos: no permitir mover un nodo dentro de su subárbol.
        if (parent.path === oldPath || parent.path.startsWith(oldPath + "/")) {
          return reply.status(400).send({ error: "La relación padre-hijo genera un ciclo" });
        }
        parentPath = parent.path;
      }

      const newPath = buildPath(parentPath, segment);

      await prisma.location.update({
        where: { id: locationId },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.parentId !== undefined && { parentId: body.parentId }),
          ...(oldPath !== newPath && { path: newPath }),
        },
      });

      if (oldPath !== newPath) {
        const descendants = await prisma.location.findMany({
          where: { projectId, path: { startsWith: oldPath + "/" } },
          select: { id: true, path: true },
        });
        for (const d of descendants) {
          const newChildPath = newPath + d.path.slice(oldPath.length);
          await prisma.location.update({ where: { id: d.id }, data: { path: newChildPath } });
        }
      }
    }

    const taskIdsFromAssignments =
      body.taskAssignments !== undefined ? body.taskAssignments.map((a) => a.taskDefinitionId) : null;

    if (body.taskDefinitionIds !== undefined || body.taskAssignments !== undefined) {
      await prisma.locationTask.deleteMany({ where: { locationId } });
      const idsToApply = body.taskDefinitionIds ?? taskIdsFromAssignments ?? [];
      if (idsToApply.length > 0) {
        const validTaskIds = await prisma.taskDefinition.findMany({
          where: {
            id: { in: idsToApply },
            planVersion: { projectId },
          },
          select: { id: true, progressValueType: true },
        });

        const totalsById =
          body.taskAssignments !== undefined
            ? new Map(
                body.taskAssignments.map((a) => [
                  a.taskDefinitionId,
                  a.totalQuantity === undefined ? null : a.totalQuantity,
                ])
              )
            : new Map<string, number | null>();

        await prisma.locationTask.createMany({
          data: validTaskIds.map((task) => ({
            locationId,
            taskDefinitionId: task.id,
            totalQuantity: task.progressValueType === "quantity" ? (totalsById.get(task.id) ?? null) : null,
          })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await prisma.location.findUnique({
      where: { id: locationId },
      include: { locationTasks: true },
    });
    return reply.send({
      ...updated,
      taskDefinitionIds: updated!.locationTasks.map((lt) => lt.taskDefinitionId),
      taskAssignments: updated!.locationTasks.map((lt) => ({
        taskDefinitionId: lt.taskDefinitionId,
        totalQuantity: ((lt as unknown as { totalQuantity?: number | null }).totalQuantity ?? null),
      })),
      locationTasks: undefined,
    });
  });

  app.delete("/projects/:projectId/locations/:locationId", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId, locationId } = request.params as { projectId: string; locationId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const location = await prisma.location.findFirst({
      where: { id: locationId, projectId },
    });
    if (!location) return reply.status(404).send({ error: "Location not found" });
    const descendants = await prisma.location.findMany({
      where: { projectId, path: { startsWith: location.path + "/" } },
      select: { id: true },
    });
    const allIds = [locationId, ...descendants.map((d) => d.id)];
    await prisma.locationTask.deleteMany({ where: { locationId: { in: allIds } } });
    await prisma.location.deleteMany({ where: { id: { in: allIds } } });
    return reply.status(204).send();
  });

  app.post("/projects/:projectId/locations/replicate-from/:locationId", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string } }).auth!;
    const { projectId, locationId } = request.params as { projectId: string; locationId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });
    const source = await prisma.location.findFirst({
      where: { id: locationId, projectId },
      include: { locationTasks: { select: { taskDefinitionId: true } } },
    });
    if (!source) return reply.status(404).send({ error: "Location not found" });
    const body = replicateFromLocationSchema.parse(request.body);
    const taskDefinitionIds = source.locationTasks.map((lt) => lt.taskDefinitionId);
    let parentPath: string | null = null;
    if (source.parentId) {
      const parent = await prisma.location.findFirst({
        where: { id: source.parentId, projectId },
      });
      if (!parent) return reply.status(400).send({ error: "Parent location not found" });
      parentPath = parent.path;
    }
    const nameBase = body.namePrefix ?? source.name;
    const created: { id: string; name: string; path: string; taskDefinitionIds: string[] }[] = [];
    for (let i = 1; i <= body.count; i++) {
      const name = `${nameBase} ${i}`;
      const segment = name.replace(/\//g, "-").toLowerCase().replace(/\s+/g, "-");
      const path = buildPath(parentPath, segment);
      const location = await prisma.location.create({
        data: {
          projectId,
          parentId: source.parentId,
          levelId: source.levelId,
          name,
          path,
        },
      });
      if (taskDefinitionIds.length) {
        await prisma.locationTask.createMany({
          data: taskDefinitionIds.map((taskDefinitionId) => ({ locationId: location.id, taskDefinitionId })),
          skipDuplicates: true,
        });
      }
      created.push({
        id: location.id,
        name: location.name,
        path: location.path,
        taskDefinitionIds,
      });
    }
    return reply.status(201).send({ locations: created });
  });
}
