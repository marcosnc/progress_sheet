import { getEvents } from "../event-store.js";

export interface VelocityProjection {
  taskDefinitionId: string;
  locationId: string;
  /** Progress events per day (average) */
  ratePerDay: number;
  /** Estimated days to reach 100% from current value (if percent) */
  daysToComplete: number | null;
  currentValue: number;
  lastEventAt: string;
}

/**
 * Estimate velocity from progress events: events per day and (if percent) days to complete.
 */
export async function getVelocityProjections(
  projectId: string,
  options: { taskDefinitionId?: string; locationId?: string } = {}
): Promise<VelocityProjection[]> {
  const events = await getEvents(projectId, { types: ["progress.recorded"], limit: 5000 });
  if (events.length === 0) return [];

  const byKey = new Map<
    string,
    { values: number[]; lastAt: Date; lastValue: number }
  >();

  for (const ev of events) {
    const payload = JSON.parse(ev.payload) as {
      taskDefinitionId: string;
      locationId: string;
      value: number | string;
      delta?: number;
    };
    if (options.taskDefinitionId && payload.taskDefinitionId !== options.taskDefinitionId) continue;
    if (options.locationId && payload.locationId !== options.locationId) continue;

    const key = `${payload.taskDefinitionId}:${payload.locationId}`;
    const numVal = typeof payload.value === "number" ? payload.value : parseFloat(String(payload.value));
    if (Number.isNaN(numVal)) continue;

    const occurredAt = new Date(ev.occurredAt);
    let entry = byKey.get(key);
    if (!entry) {
      entry = { values: [], lastAt: occurredAt, lastValue: numVal };
      byKey.set(key, entry);
    }
    entry.values.push(numVal);
    if (occurredAt > entry.lastAt) {
      entry.lastAt = occurredAt;
      entry.lastValue = numVal;
    }
  }

  const firstEvent = new Date(events[0].occurredAt);
  const lastEvent = new Date(events[events.length - 1].occurredAt);
  const daysSpan = Math.max(0.001, (lastEvent.getTime() - firstEvent.getTime()) / (1000 * 60 * 60 * 24));

  const result: VelocityProjection[] = [];
  for (const [key, entry] of byKey) {
    const [taskDefinitionId, locationId] = key.split(":");
    const ratePerDay = entry.values.length / daysSpan;
    const currentValue = entry.lastValue;
    const daysToComplete =
      currentValue >= 0 && currentValue < 100 && ratePerDay > 0
        ? (100 - currentValue) / ratePerDay
        : null;
    result.push({
      taskDefinitionId,
      locationId,
      ratePerDay,
      daysToComplete,
      currentValue,
      lastEventAt: entry.lastAt.toISOString(),
    });
  }
  return result;
}

/**
 * What-if: project completion date if we assume a given rate (e.g. "X % per day").
 */
export function whatIfCompletionDays(
  currentValue: number,
  targetValue: number,
  assumedRatePerDay: number
): number | null {
  if (assumedRatePerDay <= 0) return null;
  const remaining = targetValue - currentValue;
  if (remaining <= 0) return 0;
  return remaining / assumedRatePerDay;
}
