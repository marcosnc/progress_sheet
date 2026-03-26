/** Tenant (organization). All data is isolated by tenant. */
export interface Tenant {
  id: string;
  name: string;
  createdAt: Date;
}

/** Project: building, house, neighborhood - user-defined. */
export interface Project {
  id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Location level in the tree (e.g. "building", "floor", "unit"). */
export interface LocationLevel {
  id: string;
  tenantId: string;
  name: string;
  order: number;
}

/** A node in the location tree (e.g. "Floor 3", "Unit 3A"). */
export interface Location {
  id: string;
  projectId: string;
  parentId: string | null;
  levelId: string;
  name: string;
  path: string; // e.g. "building-1/floor-3/unit-3a" for efficient queries
  createdAt: Date;
}

/** Progress value type for a task. */
export type ProgressValueType = "percent" | "quantity" | "state";

/** Task definition in a plan version. */
export interface TaskDefinition {
  id: string;
  planVersionId: string;
  templateId: string | null;
  name: string;
  progressValueType: ProgressValueType;
  parentTaskDefinitionId: string | null;
  /** For quantity: unit label e.g. "m²", "unidades". */
  quantityUnit: string | null;
  /** For state: allowed values e.g. ["pending", "in_progress", "done"]. */
  stateOptions: string[] | null;
  /** Dimension values (e.g. supplierId, artifactTypeId) - flexible key-value. */
  dimensionValues: Record<string, string>;
  createdAt: Date;
}

/** Dependency between tasks (task A must progress before task B). */
export interface TaskDependency {
  id: string;
  planVersionId: string;
  taskId: string;
  dependsOnTaskId: string;
}

/** Reusable task template ("functional unit") instantiated N times. */
export interface TaskTemplate {
  id: string;
  tenantId: string;
  name: string;
  taskDefinitionIds: string[]; // refs to task defs that belong to this template
  createdAt: Date;
}

/** Plan version - snapshot of task definitions and structure. */
export interface PlanVersion {
  id: string;
  projectId: string;
  version: number;
  createdAt: Date;
  createdBy: string;
}

/** User role per tenant or project. */
export type Role = "planner" | "tracker" | "viewer";

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: Role;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: Role;
}
