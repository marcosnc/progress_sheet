import { DATA_TRANSFER_FORMAT_VERSION } from "@progress-sheet/shared";

export const SHEET_NAMES = {
  metadata: "_Metadatos",
  levels: "Niveles",
  dimensions: "Dimensiones",
  tasks: "Tareas",
  locations: "Ubicaciones",
  assignments: "Asignaciones",
  dependencies: "Dependencias",
  progress: "Avance",
} as const;

export const METADATA_KEYS = {
  formatVersion: "formato_version",
  projectId: "proyecto_id",
  projectName: "proyecto_nombre",
  tenantId: "tenant_id",
  planVersionId: "plan_version_id",
  planVersion: "plan_version",
  exportedAt: "exportado_en",
} as const;

export { DATA_TRANSFER_FORMAT_VERSION };

export function buildPath(parentPath: string | null, segment: string): string {
  return parentPath ? `${parentPath}/${segment}` : segment;
}

export function nameToSegment(name: string): string {
  return name.replace(/\//g, "-").toLowerCase().replace(/\s+/g, "-");
}

export function taskRefKey(name: string, parentName: string): string {
  return `${name}\0${parentName}`;
}

export function parseTaskRefKey(key: string): { name: string; parentName: string } {
  const [name, parentName = ""] = key.split("\0");
  return { name, parentName };
}

export function formatIsoDate(d: Date): string {
  return d.toISOString();
}

export function parseIsoDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dimensionCellToBool(value: unknown): boolean {
  if (value == null || value === "") return false;
  const s = String(value).trim().toLowerCase();
  return s === "sí" || s === "si" || s === "yes" || s === "1" || s === "true";
}

export function boolToDimensionCell(v: boolean): string {
  return v ? "Sí" : "";
}
