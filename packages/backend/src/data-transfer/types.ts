export interface ParsedLevel {
  systemId: string | null;
  name: string;
  order: number;
  rowNumber: number;
}

export interface ParsedDimension {
  systemId: string | null;
  name: string;
  order: number;
  rowNumber: number;
}

export interface ParsedTask {
  systemId: string | null;
  name: string;
  parentName: string;
  progressValueType: "percent" | "quantity" | "state";
  quantityUnit: string | null;
  stateOptions: string[] | null;
  dimensionValues: Record<string, boolean>;
  rowNumber: number;
}

export interface ParsedLocation {
  systemId: string | null;
  name: string;
  levelName: string;
  parentPath: string;
  rowNumber: number;
}

export interface ParsedAssignment {
  locationPath: string;
  taskName: string;
  taskParentName: string;
  totalQuantity: number | null;
  rowNumber: number;
}

export interface ParsedDependency {
  taskName: string;
  taskParentName: string;
  dependsOnName: string;
  dependsOnParentName: string;
  rowNumber: number;
}

export interface ParsedProgressEvent {
  eventId: string | null;
  locationPath: string;
  taskName: string;
  taskParentName: string;
  value: number | string;
  occurredAt: Date;
  userEmail: string;
  rowNumber: number;
}

export interface ParsedWorkbook {
  formatVersion: string;
  projectId: string | null;
  projectName: string | null;
  tenantId: string | null;
  planVersionId: string | null;
  levels: ParsedLevel[];
  dimensions: ParsedDimension[];
  tasks: ParsedTask[];
  locations: ParsedLocation[];
  assignments: ParsedAssignment[];
  dependencies: ParsedDependency[];
  progressEvents: ParsedProgressEvent[];
}

export interface ResolvedTaskRef {
  id: string;
  name: string;
  parentName: string;
  parentId: string | null;
}

export interface ProjectSnapshot {
  tenantId: string;
  projectId: string;
  projectName: string;
  planVersionId: string;
  planVersion: number;
  levels: { id: string; name: string; order: number }[];
  dimensions: { id: string; name: string; order: number }[];
  tasks: {
    id: string;
    name: string;
    parentTaskDefinitionId: string | null;
    progressValueType: string;
    quantityUnit: string | null;
    stateOptions: string | null;
    dimensionValues: string | null;
  }[];
  locations: {
    id: string;
    name: string;
    parentId: string | null;
    levelId: string;
    path: string;
  }[];
  assignments: {
    locationId: string;
    taskDefinitionId: string;
    totalQuantity: number | null;
  }[];
  dependencies: {
    id: string;
    taskId: string;
    dependsOnTaskId: string;
  }[];
  progressEvents: {
    id: string;
    taskDefinitionId: string;
    locationId: string;
    value: number | string;
    occurredAt: Date;
    userId: string;
    userEmail: string;
    sequence: number;
  }[];
}

export interface ChangePayload {
  entity: string;
  action: "create" | "update" | "delete";
  data: Record<string, unknown>;
}

export interface StoredImportSession {
  tenantId: string;
  projectId: string;
  userId: string;
  createdAt: Date;
  changes: Array<{
    id: string;
    entity: string;
    action: "create" | "update" | "delete";
    label: string;
    fieldChanges?: { field: string; before: unknown; after: unknown }[];
    warnings?: string[];
    payload: ChangePayload;
  }>;
}
