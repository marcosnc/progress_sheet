/** Event types for the event store. */
export type PlanEventType =
  | "plan.created"
  | "plan.task_added"
  | "plan.task_updated"
  | "plan.task_removed"
  | "plan.dependency_added"
  | "plan.dependency_removed"
  | "plan.location_added"
  | "plan.location_updated"
  | "plan.location_removed";

export type ProgressEventType = "progress.recorded";

export type EventType = PlanEventType | ProgressEventType;

/** Base event envelope. */
export interface BaseEvent {
  id: string;
  tenantId: string;
  projectId: string;
  type: EventType;
  occurredAt: Date;
  userId: string;
  sequence: number;
}

/** Progress event: immutable record of progress change. */
export interface ProgressEventPayload {
  taskDefinitionId: string;
  locationId: string;
  /** For percent: 0-100. For quantity: absolute value. For state: index or value. */
  value: number | string;
  /** Optional: delta instead of absolute (for quantity). */
  delta?: number;
}

export interface ProgressEvent extends BaseEvent {
  type: "progress.recorded";
  payload: ProgressEventPayload;
}

/** Plan events - structure changes. */
export interface PlanTaskAddedPayload {
  taskDefinitionId: string;
  name: string;
  progressValueType: "percent" | "quantity" | "state";
  quantityUnit?: string | null;
  stateOptions?: string[] | null;
  dimensionValues?: Record<string, string>;
  templateId?: string | null;
  parentTaskDefinitionId?: string | null;
}

export interface PlanTaskAddedEvent extends BaseEvent {
  type: "plan.task_added";
  payload: PlanTaskAddedPayload;
}

export interface PlanCreatedPayload {
  planVersionId: string;
  version: number;
}

export interface PlanCreatedEvent extends BaseEvent {
  type: "plan.created";
  payload: PlanCreatedPayload;
}

export type DomainEvent = ProgressEvent | PlanTaskAddedEvent | PlanCreatedEvent;
