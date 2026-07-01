import ExcelJS from "exceljs";
import { DATA_TRANSFER_FORMAT_VERSION } from "@progress-sheet/shared";
import {
  SHEET_NAMES,
  METADATA_KEYS,
  boolToDimensionCell,
  formatIsoDate,
} from "./constants.js";
import { loadProjectSnapshot, getTaskParentName } from "./load-project-snapshot.js";

export async function exportProjectToXlsx(
  tenantId: string,
  projectId: string
): Promise<Buffer> {
  const snapshot = await loadProjectSnapshot(tenantId, projectId);
  if (!snapshot) throw new Error("Project not found");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Progress Sheet";
  workbook.created = new Date();

  const metaSheet = workbook.addWorksheet(SHEET_NAMES.metadata);
  metaSheet.state = "hidden";
  const metaRows: [string, string][] = [
    [METADATA_KEYS.formatVersion, DATA_TRANSFER_FORMAT_VERSION],
    [METADATA_KEYS.projectId, snapshot.projectId],
    [METADATA_KEYS.projectName, snapshot.projectName],
    [METADATA_KEYS.tenantId, snapshot.tenantId],
    [METADATA_KEYS.planVersionId, snapshot.planVersionId],
    [METADATA_KEYS.planVersion, String(snapshot.planVersion)],
    [METADATA_KEYS.exportedAt, formatIsoDate(new Date())],
  ];
  metaSheet.addRow(["clave", "valor"]);
  for (const [k, v] of metaRows) metaSheet.addRow([k, v]);

  const levelsSheet = workbook.addWorksheet(SHEET_NAMES.levels);
  levelsSheet.addRow(["id_sistema", "nombre", "orden"]);
  for (const level of snapshot.levels) {
    levelsSheet.addRow([level.id, level.name, level.order]);
  }

  const dimensionsSheet = workbook.addWorksheet(SHEET_NAMES.dimensions);
  dimensionsSheet.addRow(["id_sistema", "nombre", "orden"]);
  for (const dim of snapshot.dimensions) {
    dimensionsSheet.addRow([dim.id, dim.name, dim.order]);
  }

  const dimensionNames = snapshot.dimensions.map((d) => d.name);
  const tasksSheet = workbook.addWorksheet(SHEET_NAMES.tasks);
  tasksSheet.addRow([
    "id_sistema",
    "nombre",
    "tarea_padre",
    "tipo_avance",
    "unidad_cantidad",
    "opciones_estado",
    ...dimensionNames,
  ]);
  for (const task of snapshot.tasks) {
    const parentName = getTaskParentName(task.id, snapshot.tasks);
    let stateOptionsStr = "";
    if (task.stateOptions) {
      try {
        const opts = JSON.parse(task.stateOptions) as string[];
        stateOptionsStr = opts.join(", ");
      } catch {
        stateOptionsStr = task.stateOptions;
      }
    }
    let dimValues: Record<string, string> = {};
    if (task.dimensionValues) {
      try {
        dimValues = JSON.parse(task.dimensionValues) as Record<string, string>;
      } catch {
        dimValues = {};
      }
    }
    const dimCols = snapshot.dimensions.map((d) =>
      boolToDimensionCell(dimValues[d.id] === "1")
    );
    tasksSheet.addRow([
      task.id,
      task.name,
      parentName,
      task.progressValueType,
      task.quantityUnit ?? "",
      stateOptionsStr,
      ...dimCols,
    ]);
  }

  const levelNameById = new Map(snapshot.levels.map((l) => [l.id, l.name]));
  const pathByLocationId = new Map(snapshot.locations.map((l) => [l.id, l.path]));

  const locationsSheet = workbook.addWorksheet(SHEET_NAMES.locations);
  locationsSheet.addRow(["id_sistema", "nombre", "nivel", "ubicacion_padre", "path"]);
  for (const loc of snapshot.locations) {
    const parentPath = loc.parentId ? (pathByLocationId.get(loc.parentId) ?? "") : "";
    locationsSheet.addRow([
      loc.id,
      loc.name,
      levelNameById.get(loc.levelId) ?? "",
      parentPath,
      loc.path,
    ]);
  }

  const assignmentsSheet = workbook.addWorksheet(SHEET_NAMES.assignments);
  assignmentsSheet.addRow(["ubicacion", "tarea", "tarea_padre", "cantidad_total"]);
  for (const assignment of snapshot.assignments) {
    const loc = snapshot.locations.find((l) => l.id === assignment.locationId);
    const task = snapshot.tasks.find((t) => t.id === assignment.taskDefinitionId);
    if (!loc || !task) continue;
    assignmentsSheet.addRow([
      loc.path,
      task.name,
      getTaskParentName(task.id, snapshot.tasks),
      assignment.totalQuantity ?? "",
    ]);
  }

  const dependenciesSheet = workbook.addWorksheet(SHEET_NAMES.dependencies);
  dependenciesSheet.addRow(["tarea", "tarea_padre", "depende_de", "depende_de_padre"]);
  for (const dep of snapshot.dependencies) {
    const task = snapshot.tasks.find((t) => t.id === dep.taskId);
    const dependsOn = snapshot.tasks.find((t) => t.id === dep.dependsOnTaskId);
    if (!task || !dependsOn) continue;
    dependenciesSheet.addRow([
      task.name,
      getTaskParentName(task.id, snapshot.tasks),
      dependsOn.name,
      getTaskParentName(dependsOn.id, snapshot.tasks),
    ]);
  }

  const progressSheet = workbook.addWorksheet(SHEET_NAMES.progress);
  progressSheet.addRow([
    "id_evento",
    "ubicacion",
    "tarea",
    "tarea_padre",
    "valor",
    "fecha",
    "usuario",
  ]);
  for (const ev of snapshot.progressEvents) {
    const loc = snapshot.locations.find((l) => l.id === ev.locationId);
    const task = snapshot.tasks.find((t) => t.id === ev.taskDefinitionId);
    if (!loc || !task) continue;
    progressSheet.addRow([
      ev.id,
      loc.path,
      task.name,
      getTaskParentName(task.id, snapshot.tasks),
      ev.value,
      formatIsoDate(ev.occurredAt),
      ev.userEmail,
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
