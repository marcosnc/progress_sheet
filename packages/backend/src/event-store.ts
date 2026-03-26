import { prisma } from "./db.js";
import type { EventType } from "@progress-sheet/shared";

export interface AppendEventInput {
  tenantId: string;
  projectId: string;
  type: EventType;
  payload: unknown;
  userId: string;
  occurredAt?: Date;
}

export async function getNextSequence(projectId: string): Promise<number> {
  const last = await prisma.event.findFirst({
    where: { projectId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });
  return (last?.sequence ?? 0) + 1;
}

export async function appendEvent(input: AppendEventInput): Promise<string> {
  const sequence = await getNextSequence(input.projectId);
  const event = await prisma.event.create({
    data: {
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      projectId: input.projectId,
      type: input.type,
      payload: JSON.stringify(input.payload),
      occurredAt: input.occurredAt ?? new Date(),
      userId: input.userId,
      sequence,
    },
  });
  return event.id;
}

export async function getEvents(
  projectId: string,
  options: {
    fromSequence?: number;
    toSequence?: number;
    types?: EventType[];
    limit?: number;
  } = {}
) {
  const where: { projectId: string; sequence?: object; type?: object } = {
    projectId,
  };
  if (options.fromSequence != null || options.toSequence != null) {
    where.sequence = {};
    if (options.fromSequence != null) (where.sequence as Record<string, number>).gte = options.fromSequence;
    if (options.toSequence != null) (where.sequence as Record<string, number>).lte = options.toSequence;
  }
  if (options.types?.length) where.type = { in: options.types };

  return prisma.event.findMany({
    where,
    orderBy: { sequence: "asc" },
    take: options.limit ?? 10000,
  });
}
