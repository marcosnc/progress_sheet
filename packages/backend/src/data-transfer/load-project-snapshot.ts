import { prisma } from "../db.js";
import { getEvents } from "../event-store.js";
import type { ProjectSnapshot } from "./types.js";

export async function loadProjectSnapshot(
  tenantId: string,
  projectId: string
): Promise<ProjectSnapshot | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId },
    include: {
      tenant: { select: { id: true } },
      planVersions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!project) return null;

  const planVersion = project.planVersions[0];
  if (!planVersion) {
    return {
      tenantId: project.tenantId,
      projectId: project.id,
      projectName: project.name,
      planVersionId: "",
      planVersion: 0,
      levels: [],
      dimensions: [],
      tasks: [],
      locations: [],
      assignments: [],
      dependencies: [],
      progressEvents: [],
    };
  }

  const [levels, dimensions, tasks, locations, locationTasks, dependencies, events, users] =
    await Promise.all([
      prisma.locationLevel.findMany({
        where: { tenantId },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      }),
      prisma.dimension.findMany({
        where: { tenantId },
        orderBy: [{ order: "asc" }, { name: "asc" }],
      }),
      prisma.taskDefinition.findMany({
        where: { planVersionId: planVersion.id },
        orderBy: { name: "asc" },
      }),
      prisma.location.findMany({
        where: { projectId },
        orderBy: { path: "asc" },
      }),
      prisma.locationTask.findMany({
        where: { location: { projectId } },
      }),
      prisma.taskDependency.findMany({
        where: { planVersionId: planVersion.id },
      }),
      getEvents(projectId, { types: ["progress.recorded"], limit: 50000 }),
      prisma.user.findMany({
        where: {
          tenantMembers: { some: { tenantId } },
        },
        select: { id: true, email: true },
      }),
    ]);

  const userEmailById = new Map(users.map((u) => [u.id, u.email]));

  const progressEvents = events.map((ev) => {
    const payload = JSON.parse(ev.payload) as {
      taskDefinitionId: string;
      locationId: string;
      value: number | string;
    };
    return {
      id: ev.id,
      taskDefinitionId: payload.taskDefinitionId,
      locationId: payload.locationId,
      value: payload.value,
      occurredAt: ev.occurredAt,
      userId: ev.userId,
      userEmail: userEmailById.get(ev.userId) ?? ev.userId,
      sequence: ev.sequence,
    };
  });

  return {
    tenantId: project.tenantId,
    projectId: project.id,
    projectName: project.name,
    planVersionId: planVersion.id,
    planVersion: planVersion.version,
    levels: levels.map((l) => ({ id: l.id, name: l.name, order: l.order })),
    dimensions: dimensions.map((d) => ({ id: d.id, name: d.name, order: d.order })),
    tasks: tasks.map((t) => ({
      id: t.id,
      name: t.name,
      parentTaskDefinitionId: t.parentTaskDefinitionId,
      progressValueType: t.progressValueType,
      quantityUnit: t.quantityUnit,
      stateOptions: t.stateOptions,
      dimensionValues: t.dimensionValues,
    })),
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      parentId: l.parentId,
      levelId: l.levelId,
      path: l.path,
    })),
    assignments: locationTasks.map((lt) => ({
      locationId: lt.locationId,
      taskDefinitionId: lt.taskDefinitionId,
      totalQuantity: lt.totalQuantity,
    })),
    dependencies: dependencies.map((d) => ({
      id: d.id,
      taskId: d.taskId,
      dependsOnTaskId: d.dependsOnTaskId,
    })),
    progressEvents,
  };
}

export function getTaskParentName(
  taskId: string,
  tasks: ProjectSnapshot["tasks"]
): string {
  const task = tasks.find((t) => t.id === taskId);
  if (!task?.parentTaskDefinitionId) return "";
  const parent = tasks.find((t) => t.id === task.parentTaskDefinitionId);
  return parent?.name ?? "";
}

export function buildTaskRefMap(tasks: ProjectSnapshot["tasks"]): Map<string, string> {
  const map = new Map<string, string>();
  for (const task of tasks) {
    const parentName = task.parentTaskDefinitionId
      ? (tasks.find((t) => t.id === task.parentTaskDefinitionId)?.name ?? "")
      : "";
    map.set(`${task.name}\0${parentName}`, task.id);
  }
  return map;
}

export function buildLocationPathMap(locations: ProjectSnapshot["locations"]): Map<string, string> {
  return new Map(locations.map((l) => [l.path, l.id]));
}

export function buildLevelNameMap(levels: ProjectSnapshot["levels"]): Map<string, string> {
  return new Map(levels.map((l) => [l.name, l.id]));
}

export function buildDimensionNameMap(dimensions: ProjectSnapshot["dimensions"]): Map<string, string> {
  return new Map(dimensions.map((d) => [d.name, d.id]));
}
