import { prisma } from "../db.js";
import { appendEvent } from "../event-store.js";
import { computeProgressState } from "../aggregation/engine.js";
import { loadProjectSnapshot } from "./load-project-snapshot.js";
import type { StoredImportSession } from "./types.js";

async function resolveUserIdByEmail(
  tenantId: string,
  email: string,
  fallbackUserId: string
): Promise<string> {
  if (!email) return fallbackUserId;
  const user = await prisma.user.findFirst({
    where: { email, tenantMembers: { some: { tenantId } } },
    select: { id: true },
  });
  return user?.id ?? fallbackUserId;
}

async function resolveTaskId(
  projectId: string,
  planVersionId: string,
  taskName: string,
  taskParentName: string
): Promise<string | null> {
  const tasks = await prisma.taskDefinition.findMany({
    where: { planVersionId },
    select: { id: true, name: true, parentTaskDefinitionId: true },
  });
  for (const t of tasks) {
    const parentName = t.parentTaskDefinitionId
      ? (tasks.find((p) => p.id === t.parentTaskDefinitionId)?.name ?? "")
      : "";
    if (t.name === taskName && parentName === taskParentName) return t.id;
  }
  return null;
}

async function resolveLocationIdByPath(
  projectId: string,
  path: string
): Promise<string | null> {
  const loc = await prisma.location.findFirst({
    where: { projectId, path },
    select: { id: true },
  });
  return loc?.id ?? null;
}

async function resolveLevelIdByName(tenantId: string, name: string): Promise<string | null> {
  const level = await prisma.locationLevel.findFirst({
    where: { tenantId, name },
    select: { id: true },
  });
  return level?.id ?? null;
}

export async function applyImportChanges(
  session: StoredImportSession,
  approvedChangeIds: string[]
): Promise<{ applied: number; skipped: number; errors: string[] }> {
  const approved = new Set(approvedChangeIds);
  const toApply = session.changes.filter((c) => approved.has(c.id));
  const errors: string[] = [];
  let applied = 0;
  let skipped = session.changes.length - toApply.length;

  const snapshot = await loadProjectSnapshot(session.tenantId, session.projectId);
  if (!snapshot) throw new Error("Project not found");

  let planVersionId = snapshot.planVersionId;
  if (!planVersionId) {
    const plan = await prisma.planVersion.create({
      data: {
        projectId: session.projectId,
        version: 1,
        createdBy: session.userId,
      },
    });
    planVersionId = plan.id;
  }

  const createsUpdates = toApply.filter((c) => c.action !== "delete");
  const deletes = toApply.filter((c) => c.action === "delete");

  const entityOrder = [
    "locationLevel",
    "dimension",
    "task",
    "location",
    "dependency",
    "assignment",
    "progressEvent",
  ] as const;

  const deleteOrder = [...entityOrder].reverse();

  try {
    for (const entity of entityOrder) {
      for (const change of createsUpdates.filter((c) => c.entity === entity)) {
        try {
          await applySingleChange(change, session, planVersionId);
          applied++;
        } catch (e) {
          errors.push(`${change.label}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    for (const entity of deleteOrder) {
      for (const change of deletes.filter((c) => c.entity === entity)) {
        try {
          await applySingleChange(change, session, planVersionId);
          applied++;
        } catch (e) {
          errors.push(`${change.label}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    await computeProgressState(session.projectId, { persist: true });
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return { applied, skipped, errors };
}

async function applySingleChange(
  change: StoredImportSession["changes"][0],
  session: StoredImportSession,
  planVersionId: string
): Promise<void> {
  const { entity, action, data } = change.payload;
  const d = data as Record<string, unknown>;

  if (entity === "locationLevel") {
    if (action === "create") {
      await prisma.locationLevel.create({
        data: {
          tenantId: session.tenantId,
          name: d.name as string,
          order: d.order as number,
        },
      });
    } else if (action === "update") {
      await prisma.locationLevel.update({
        where: { id: d.id as string },
        data: { name: d.name as string, order: d.order as number },
      });
    } else if (action === "delete") {
      const inUse = await prisma.location.count({ where: { levelId: d.id as string } });
      if (inUse > 0) throw new Error(`No se puede eliminar: ${inUse} ubicación(es) usan este nivel`);
      await prisma.locationLevel.delete({ where: { id: d.id as string } });
    }
    return;
  }

  if (entity === "dimension") {
    if (action === "create") {
      await prisma.dimension.create({
        data: {
          tenantId: session.tenantId,
          name: d.name as string,
          order: d.order as number,
        },
      });
    } else if (action === "update") {
      await prisma.dimension.update({
        where: { id: d.id as string },
        data: { name: d.name as string, order: d.order as number },
      });
    } else if (action === "delete") {
      await prisma.dimension.delete({ where: { id: d.id as string } });
    }
    return;
  }

  if (entity === "task") {
    if (action === "create") {
      let parentTaskDefinitionId: string | null = null;
      const parentName = d.parentName as string;
      if (parentName) {
        const candidates = await prisma.taskDefinition.findMany({
          where: { planVersionId, name: parentName },
          select: { id: true, parentTaskDefinitionId: true },
        });
        if (candidates.length === 1) {
          parentTaskDefinitionId = candidates[0].id;
        } else if (candidates.length > 1) {
          throw new Error(`Tarea padre "${parentName}" es ambigua; renombrá las tareas duplicadas`);
        } else {
          throw new Error(`Tarea padre "${parentName}" no encontrada`);
        }
      }
      await prisma.taskDefinition.create({
        data: {
          planVersionId,
          name: d.name as string,
          progressValueType: d.progressValueType as string,
          quantityUnit: (d.quantityUnit as string | null) ?? null,
          stateOptions: (d.stateOptions as string | null) ?? null,
          dimensionValues: (d.dimensionValues as string | null) ?? null,
          parentTaskDefinitionId,
        },
      });
    } else if (action === "update") {
      let parentTaskDefinitionId: string | null = null;
      const parentName = d.parentName as string;
      if (parentName) {
        const candidates = await prisma.taskDefinition.findMany({
          where: { planVersionId, name: parentName },
          select: { id: true },
        });
        if (candidates.length === 1) parentTaskDefinitionId = candidates[0].id;
        else if (candidates.length > 1) {
          throw new Error(`Tarea padre "${parentName}" es ambigua`);
        }
      }
      await prisma.taskDefinition.update({
        where: { id: d.id as string },
        data: {
          name: d.name as string,
          progressValueType: d.progressValueType as string,
          quantityUnit: (d.quantityUnit as string | null) ?? null,
          stateOptions: (d.stateOptions as string | null) ?? null,
          dimensionValues: (d.dimensionValues as string | null) ?? null,
          parentTaskDefinitionId,
        },
      });
    } else if (action === "delete") {
      const taskId = d.id as string;
      await prisma.locationTask.deleteMany({ where: { taskDefinitionId: taskId } });
      await prisma.progressSnapshot.deleteMany({
        where: { projectId: session.projectId, taskDefinitionId: taskId },
      });
      await prisma.taskDependency.deleteMany({
        where: { OR: [{ taskId }, { dependsOnTaskId: taskId }] },
      });
      await prisma.taskDefinition.updateMany({
        where: { parentTaskDefinitionId: taskId },
        data: { parentTaskDefinitionId: null },
      });
      await prisma.taskDefinition.delete({ where: { id: taskId } });
    }
    return;
  }

  if (entity === "location") {
    if (action === "create") {
      const levelId = await resolveLevelIdByName(session.tenantId, d.levelName as string);
      if (!levelId) throw new Error(`Nivel "${d.levelName}" no encontrado`);
      let parentId: string | null = null;
      const parentPath = d.parentPath as string;
      if (parentPath) {
        parentId = await resolveLocationIdByPath(session.projectId, parentPath);
        if (!parentId) throw new Error(`Ubicación padre "${parentPath}" no encontrada`);
      }
      await prisma.location.create({
        data: {
          projectId: session.projectId,
          name: d.name as string,
          levelId,
          parentId,
          path: d.path as string,
        },
      });
    } else if (action === "update") {
      const levelId = await resolveLevelIdByName(session.tenantId, d.levelName as string);
      if (!levelId) throw new Error(`Nivel "${d.levelName}" no encontrado`);
      const locationId = d.id as string;
      const parentPath = d.parentPath as string;
      let parentId: string | null = null;
      if (parentPath) {
        parentId = await resolveLocationIdByPath(session.projectId, parentPath);
        if (!parentId) throw new Error(`Ubicación padre "${parentPath}" no encontrada`);
      }
      const existing = await prisma.location.findUnique({ where: { id: locationId } });
      if (!existing) throw new Error("Ubicación no encontrada");
      const oldPath = existing.path;
      const newPath = d.path as string;

      await prisma.location.update({
        where: { id: locationId },
        data: {
          name: d.name as string,
          levelId,
          parentId,
          path: newPath,
        },
      });

      if (oldPath !== newPath) {
        const descendants = await prisma.location.findMany({
          where: { projectId: session.projectId, path: { startsWith: oldPath + "/" } },
          select: { id: true, path: true },
        });
        for (const desc of descendants) {
          const newChildPath = newPath + desc.path.slice(oldPath.length);
          await prisma.location.update({ where: { id: desc.id }, data: { path: newChildPath } });
        }
      }
    } else if (action === "delete") {
      const locationId = d.id as string;
      const path = d.path as string;
      const descendants = await prisma.location.findMany({
        where: { projectId: session.projectId, path: { startsWith: path + "/" } },
        select: { id: true },
      });
      const allIds = [locationId, ...descendants.map((x) => x.id)];
      await prisma.locationTask.deleteMany({ where: { locationId: { in: allIds } } });
      await prisma.progressSnapshot.deleteMany({
        where: { projectId: session.projectId, locationId: { in: allIds } },
      });
      await prisma.location.deleteMany({ where: { id: { in: allIds } } });
    }
    return;
  }

  if (entity === "dependency") {
    if (action === "create") {
      const taskId = await resolveTaskId(
        session.projectId,
        planVersionId,
        d.taskName as string,
        d.taskParentName as string
      );
      const dependsOnTaskId = await resolveTaskId(
        session.projectId,
        planVersionId,
        d.dependsOnName as string,
        d.dependsOnParentName as string
      );
      if (!taskId || !dependsOnTaskId) throw new Error("Tareas de dependencia no encontradas");
      await prisma.taskDependency.create({
        data: { planVersionId, taskId, dependsOnTaskId },
      });
    } else if (action === "delete") {
      await prisma.taskDependency.delete({ where: { id: d.id as string } });
    }
    return;
  }

  if (entity === "assignment") {
    const locationId = await resolveLocationIdByPath(
      session.projectId,
      d.locationPath as string
    );
    const taskId = await resolveTaskId(
      session.projectId,
      planVersionId,
      d.taskName as string,
      d.taskParentName as string
    );
    if (!locationId || !taskId) throw new Error("Ubicación o tarea no encontrada para asignación");

    if (action === "create" || action === "update") {
      const task = await prisma.taskDefinition.findUnique({
        where: { id: taskId },
        select: { progressValueType: true },
      });
      const totalQuantity =
        task?.progressValueType === "quantity" ? ((d.totalQuantity as number | null) ?? null) : null;

      await prisma.locationTask.upsert({
        where: {
          locationId_taskDefinitionId: { locationId, taskDefinitionId: taskId },
        },
        create: { locationId, taskDefinitionId: taskId, totalQuantity },
        update: { totalQuantity },
      });
    } else if (action === "delete") {
      await prisma.locationTask.deleteMany({
        where: { locationId, taskDefinitionId: taskId },
      });
    }
    return;
  }

  if (entity === "progressEvent") {
    if (action === "create") {
      const locationId = await resolveLocationIdByPath(
        session.projectId,
        d.locationPath as string
      );
      const taskDefinitionId = await resolveTaskId(
        session.projectId,
        planVersionId,
        d.taskName as string,
        d.taskParentName as string
      );
      if (!locationId || !taskDefinitionId) throw new Error("Ubicación o tarea no encontrada");

      const locationTask = await prisma.locationTask.findUnique({
        where: {
          locationId_taskDefinitionId: { locationId, taskDefinitionId },
        },
      });
      if (!locationTask) throw new Error("La tarea no está asignada a esta ubicación");

      const userId = await resolveUserIdByEmail(
        session.tenantId,
        d.userEmail as string,
        d.fallbackUserId as string
      );

      await appendEvent({
        tenantId: session.tenantId,
        projectId: session.projectId,
        type: "progress.recorded",
        userId,
        occurredAt: new Date(d.occurredAt as string),
        payload: {
          taskDefinitionId,
          locationId,
          value: d.value as number | string,
        },
      });
    } else if (action === "update") {
      const existing = await prisma.event.findUnique({ where: { id: d.id as string } });
      if (!existing) throw new Error("Evento no encontrado");

      const locationId = await resolveLocationIdByPath(
        session.projectId,
        d.locationPath as string
      );
      const taskDefinitionId = await resolveTaskId(
        session.projectId,
        planVersionId,
        d.taskName as string,
        d.taskParentName as string
      );
      if (!locationId || !taskDefinitionId) throw new Error("Ubicación o tarea no encontrada");

      const userId = await resolveUserIdByEmail(
        session.tenantId,
        d.userEmail as string,
        d.fallbackUserId as string
      );

      await prisma.event.update({
        where: { id: d.id as string },
        data: {
          payload: JSON.stringify({
            taskDefinitionId,
            locationId,
            value: d.value as number | string,
          }),
          occurredAt: new Date(d.occurredAt as string),
          userId,
        },
      });
    } else if (action === "delete") {
      await prisma.event.delete({ where: { id: d.id as string } });
    }
  }
}
