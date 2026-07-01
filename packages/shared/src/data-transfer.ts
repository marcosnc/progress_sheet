export const DATA_TRANSFER_FORMAT_VERSION = "1.0";

export type ChangeAction = "create" | "update" | "delete";

export type ChangeEntity =
  | "locationLevel"
  | "dimension"
  | "task"
  | "location"
  | "assignment"
  | "dependency"
  | "progressEvent";

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ProposedChange {
  id: string;
  entity: ChangeEntity;
  action: ChangeAction;
  label: string;
  fieldChanges?: FieldChange[];
  warnings?: string[];
}

export interface ImportPreviewSummary {
  creates: number;
  updates: number;
  deletes: number;
  total: number;
}

export interface ImportPreview {
  sessionId: string;
  changes: ProposedChange[];
  errors: string[];
  summary: ImportPreviewSummary;
}

export interface ApplyImportRequest {
  sessionId: string;
  approvedChangeIds: string[];
}

export interface ApplyImportResult {
  applied: number;
  skipped: number;
  errors: string[];
}
