import { prisma } from "../db.js";
import { getEvents } from "../event-store.js";

export type AggregationStrategy = "sum" | "average" | "last_state" | "weighted";

interface TaskDef {
  id: string;
  progressValueType: string;
  quantityUnit: string | null;
  stateOptions: string | null;
}

interface ProgressEventPayload {
  taskDefinitionId: string;
  locationId: string;
  value: number | string;
  delta?: number;
}

/** Compute current progress state from events and optionally persist to ProgressSnapshot. */
export async function computeProgressState(
  projectId: string,
  options: { persist?: boolean } = {}
): Promise<Map<string, { taskDefinitionId: string; locationId: string; value: number | string }>> {
  const events = await getEvents(projectId, { types: ["progress.recorded"], limit: 50000 });
  const taskDefs = await prisma.taskDefinition.findMany({
    where: { planVersion: { projectId } },
    select: { id: true, progressValueType: true, quantityUnit: true, stateOptions: true },
  });
  const taskMap = new Map<string, TaskDef>(taskDefs.map((t) => [t.id, t]));

  const byKey = new Map<string, { value: number | string; lastSeq: number }>();

  for (const ev of events) {
    const payload = JSON.parse(ev.payload) as ProgressEventPayload;
    const key = `${payload.taskDefinitionId}:${payload.locationId}`;
    const task = taskMap.get(payload.taskDefinitionId);
    if (!task) continue;

    const existing = byKey.get(key);
    const seq = Number(ev.sequence);

    if (task.progressValueType === "quantity" && payload.delta != null) {
      const prev = (existing?.value as number) ?? 0;
      const next = prev + payload.delta;
      if (!existing || seq > existing.lastSeq) {
        byKey.set(key, { value: next, lastSeq: seq });
      }
    } else {
      byKey.set(key, { value: payload.value, lastSeq: seq });
    }
  }

  const result = new Map<string, { taskDefinitionId: string; locationId: string; value: number | string }>();
  for (const [key, { value }] of byKey) {
    const [taskDefinitionId, locationId] = key.split(":");
    result.set(key, { taskDefinitionId, locationId, value });
  }

  if (options.persist) {
    const now = new Date();
    for (const [, row] of result) {
      await prisma.progressSnapshot.upsert({
        where: {
          projectId_taskDefinitionId_locationId: {
            projectId,
            taskDefinitionId: row.taskDefinitionId,
            locationId: row.locationId,
          },
        },
        create: {
          projectId,
          taskDefinitionId: row.taskDefinitionId,
          locationId: row.locationId,
          value: JSON.stringify(row.value),
          updatedAt: now,
        },
        update: {
          value: JSON.stringify(row.value),
          updatedAt: now,
        },
      });
    }
  }

  return result;
}

/** Get aggregated progress by dimension (e.g. by location path prefix for "floor" or "unit"). */
export async function getProgressAggregated(
  projectId: string,
  groupBy: "task" | "location" | "none",
  filters: { taskDefinitionId?: string; locationId?: string; locationPathPrefix?: string } = {}
): Promise<
  | { byTask: Record<string, { total: number; count: number; value: number | string }> }
  | { byLocation: Record<string, { total: number; count: number; value: number | string }> }
  | { items: Array<{ taskDefinitionId: string; locationId: string; value: number | string }> }
> {
  const state = await computeProgressState(projectId, { persist: false });
  const items = Array.from(state.values());

  let filtered = items;
  if (filters.taskDefinitionId) {
    filtered = filtered.filter((i) => i.taskDefinitionId === filters.taskDefinitionId);
  }
  if (filters.locationId) {
    filtered = filtered.filter((i) => i.locationId === filters.locationId);
  }

  if (filters.locationPathPrefix) {
    const locations = await prisma.location.findMany({
      where: { projectId, path: { startsWith: filters.locationPathPrefix } },
      select: { id: true },
    });
    const locIds = new Set(locations.map((l) => l.id));
    filtered = filtered.filter((i) => locIds.has(i.locationId));
  }

  if (groupBy === "task") {
    const byTask: Record<string, { total: number; count: number; value: number | string }> = {};
    for (const item of filtered) {
      const v = typeof item.value === "number" ? item.value : 0;
      if (!byTask[item.taskDefinitionId]) byTask[item.taskDefinitionId] = { total: 0, count: 0, value: 0 };
      byTask[item.taskDefinitionId].total += v;
      byTask[item.taskDefinitionId].count += 1;
      byTask[item.taskDefinitionId].value = byTask[item.taskDefinitionId].count
        ? (byTask[item.taskDefinitionId].total as number) / byTask[item.taskDefinitionId].count
        : 0;
    }
    return { byTask };
  }

  if (groupBy === "location") {
    const byLocation: Record<string, { total: number; count: number; value: number | string }> = {};
    for (const item of filtered) {
      const v = typeof item.value === "number" ? item.value : 0;
      if (!byLocation[item.locationId]) byLocation[item.locationId] = { total: 0, count: 0, value: 0 };
      byLocation[item.locationId].total += v;
      byLocation[item.locationId].count += 1;
      byLocation[item.locationId].value = byLocation[item.locationId].count
        ? (byLocation[item.locationId].total as number) / byLocation[item.locationId].count
        : 0;
    }
    return { byLocation };
  }

  return { items: filtered };
}
