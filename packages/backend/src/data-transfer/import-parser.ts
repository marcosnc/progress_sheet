import ExcelJS from "exceljs";
import {
  SHEET_NAMES,
  METADATA_KEYS,
  dimensionCellToBool,
  parseIsoDate,
} from "./constants.js";
import type {
  ParsedWorkbook,
  ParsedLevel,
  ParsedDimension,
  ParsedTask,
  ParsedLocation,
  ParsedAssignment,
  ParsedDependency,
  ParsedProgressEvent,
} from "./types.js";

function cellStr(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: string }).text).trim();
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function cellNum(v: ExcelJS.CellValue): number {
  const s = cellStr(v);
  if (s === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function readSheetRows(workbook: ExcelJS.Workbook, name: string): string[][] {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const values = row.values as ExcelJS.CellValue[];
    const cells = values.slice(1).map(cellStr);
    if (cells.some((c) => c !== "")) rows.push(cells);
  });
  return rows;
}

function headerIndex(headers: string[], name: string): number {
  const idx = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  return idx;
}

function readMetadata(workbook: ExcelJS.Workbook): Record<string, string> {
  const rows = readSheetRows(workbook, SHEET_NAMES.metadata);
  const meta: Record<string, string> = {};
  for (let i = 1; i < rows.length; i++) {
    const [key, value] = rows[i];
    if (key) meta[key] = value ?? "";
  }
  return meta;
}

export async function parseWorkbook(buffer: Buffer): Promise<{ parsed: ParsedWorkbook; errors: string[] }> {
  const errors: string[] = [];
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const meta = readMetadata(workbook);
  const formatVersion = meta[METADATA_KEYS.formatVersion] ?? "";
  if (!formatVersion) errors.push("Falta la hoja _Metadatos o formato_version");

  const parsed: ParsedWorkbook = {
    formatVersion,
    projectId: meta[METADATA_KEYS.projectId] || null,
    projectName: meta[METADATA_KEYS.projectName] || null,
    tenantId: meta[METADATA_KEYS.tenantId] || null,
    planVersionId: meta[METADATA_KEYS.planVersionId] || null,
    levels: [],
    dimensions: [],
    tasks: [],
    locations: [],
    assignments: [],
    dependencies: [],
    progressEvents: [],
  };

  const levelRows = readSheetRows(workbook, SHEET_NAMES.levels);
  if (levelRows.length > 0) {
    const headers = levelRows[0];
    const iId = headerIndex(headers, "id_sistema");
    const iName = headerIndex(headers, "nombre");
    const iOrder = headerIndex(headers, "orden");
    if (iName < 0) errors.push("Pestaña Niveles: falta columna nombre");
    for (let r = 1; r < levelRows.length; r++) {
      const row = levelRows[r];
      const name = row[iName] ?? "";
      if (!name) continue;
      parsed.levels.push({
        systemId: iId >= 0 && row[iId] ? row[iId] : null,
        name,
        order: iOrder >= 0 ? cellNum(row[iOrder]) : 0,
        rowNumber: r + 1,
      });
    }
  }

  const dimRows = readSheetRows(workbook, SHEET_NAMES.dimensions);
  if (dimRows.length > 0) {
    const headers = dimRows[0];
    const iId = headerIndex(headers, "id_sistema");
    const iName = headerIndex(headers, "nombre");
    const iOrder = headerIndex(headers, "orden");
    if (iName < 0) errors.push("Pestaña Dimensiones: falta columna nombre");
    for (let r = 1; r < dimRows.length; r++) {
      const row = dimRows[r];
      const name = row[iName] ?? "";
      if (!name) continue;
      parsed.dimensions.push({
        systemId: iId >= 0 && row[iId] ? row[iId] : null,
        name,
        order: iOrder >= 0 ? cellNum(row[iOrder]) : 0,
        rowNumber: r + 1,
      });
    }
  }

  const taskRows = readSheetRows(workbook, SHEET_NAMES.tasks);
  const dimensionColumnNames: string[] = [];
  if (taskRows.length > 0) {
    const headers = taskRows[0];
    const fixedCols = new Set([
      "id_sistema",
      "nombre",
      "tarea_padre",
      "tipo_avance",
      "unidad_cantidad",
      "opciones_estado",
    ]);
    for (const h of headers) {
      if (h && !fixedCols.has(h.toLowerCase())) dimensionColumnNames.push(h);
    }
    const iId = headerIndex(headers, "id_sistema");
    const iName = headerIndex(headers, "nombre");
    const iParent = headerIndex(headers, "tarea_padre");
    const iType = headerIndex(headers, "tipo_avance");
    const iUnit = headerIndex(headers, "unidad_cantidad");
    const iState = headerIndex(headers, "opciones_estado");
    if (iName < 0) errors.push("Pestaña Tareas: falta columna nombre");
    for (let r = 1; r < taskRows.length; r++) {
      const row = taskRows[r];
      const name = row[iName] ?? "";
      if (!name) continue;
      const typeRaw = (iType >= 0 ? row[iType] : "percent").toLowerCase();
      if (typeRaw !== "percent" && typeRaw !== "quantity" && typeRaw !== "state") {
        errors.push(`Tareas fila ${r + 1}: tipo_avance inválido "${typeRaw}"`);
        continue;
      }
      const stateRaw = iState >= 0 ? row[iState] : "";
      const stateOptions = stateRaw
        ? stateRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : null;
      const dimValues: Record<string, boolean> = {};
      for (const dimName of dimensionColumnNames) {
        const colIdx = headerIndex(headers, dimName);
        if (colIdx >= 0) dimValues[dimName] = dimensionCellToBool(row[colIdx]);
      }
      parsed.tasks.push({
        systemId: iId >= 0 && row[iId] ? row[iId] : null,
        name,
        parentName: iParent >= 0 ? row[iParent] ?? "" : "",
        progressValueType: typeRaw as ParsedTask["progressValueType"],
        quantityUnit: iUnit >= 0 && row[iUnit] ? row[iUnit] : null,
        stateOptions,
        dimensionValues: dimValues,
        rowNumber: r + 1,
      });
    }
  }

  const locRows = readSheetRows(workbook, SHEET_NAMES.locations);
  if (locRows.length > 0) {
    const headers = locRows[0];
    const iId = headerIndex(headers, "id_sistema");
    const iName = headerIndex(headers, "nombre");
    const iLevel = headerIndex(headers, "nivel");
    const iParent = headerIndex(headers, "ubicacion_padre");
    if (iName < 0) errors.push("Pestaña Ubicaciones: falta columna nombre");
    if (iLevel < 0) errors.push("Pestaña Ubicaciones: falta columna nivel");
    for (let r = 1; r < locRows.length; r++) {
      const row = locRows[r];
      const name = row[iName] ?? "";
      if (!name) continue;
      parsed.locations.push({
        systemId: iId >= 0 && row[iId] ? row[iId] : null,
        name,
        levelName: iLevel >= 0 ? row[iLevel] ?? "" : "",
        parentPath: iParent >= 0 ? row[iParent] ?? "" : "",
        rowNumber: r + 1,
      });
    }
  }

  const assignRows = readSheetRows(workbook, SHEET_NAMES.assignments);
  if (assignRows.length > 0) {
    const headers = assignRows[0];
    const iLoc = headerIndex(headers, "ubicacion");
    const iTask = headerIndex(headers, "tarea");
    const iParent = headerIndex(headers, "tarea_padre");
    const iQty = headerIndex(headers, "cantidad_total");
    for (let r = 1; r < assignRows.length; r++) {
      const row = assignRows[r];
      const locationPath = iLoc >= 0 ? row[iLoc] ?? "" : "";
      const taskName = iTask >= 0 ? row[iTask] ?? "" : "";
      if (!locationPath || !taskName) continue;
      const qtyRaw = iQty >= 0 ? row[iQty] : "";
      parsed.assignments.push({
        locationPath,
        taskName,
        taskParentName: iParent >= 0 ? row[iParent] ?? "" : "",
        totalQuantity: qtyRaw !== "" ? Number(qtyRaw) : null,
        rowNumber: r + 1,
      });
    }
  }

  const depRows = readSheetRows(workbook, SHEET_NAMES.dependencies);
  if (depRows.length > 0) {
    const headers = depRows[0];
    const iTask = headerIndex(headers, "tarea");
    const iParent = headerIndex(headers, "tarea_padre");
    const iDep = headerIndex(headers, "depende_de");
    const iDepParent = headerIndex(headers, "depende_de_padre");
    for (let r = 1; r < depRows.length; r++) {
      const row = depRows[r];
      const taskName = iTask >= 0 ? row[iTask] ?? "" : "";
      const dependsOnName = iDep >= 0 ? row[iDep] ?? "" : "";
      if (!taskName || !dependsOnName) continue;
      parsed.dependencies.push({
        taskName,
        taskParentName: iParent >= 0 ? row[iParent] ?? "" : "",
        dependsOnName,
        dependsOnParentName: iDepParent >= 0 ? row[iDepParent] ?? "" : "",
        rowNumber: r + 1,
      });
    }
  }

  const progressRows = readSheetRows(workbook, SHEET_NAMES.progress);
  if (progressRows.length > 0) {
    const headers = progressRows[0];
    const iId = headerIndex(headers, "id_evento");
    const iLoc = headerIndex(headers, "ubicacion");
    const iTask = headerIndex(headers, "tarea");
    const iParent = headerIndex(headers, "tarea_padre");
    const iVal = headerIndex(headers, "valor");
    const iDate = headerIndex(headers, "fecha");
    const iUser = headerIndex(headers, "usuario");
    for (let r = 1; r < progressRows.length; r++) {
      const row = progressRows[r];
      const locationPath = iLoc >= 0 ? row[iLoc] ?? "" : "";
      const taskName = iTask >= 0 ? row[iTask] ?? "" : "";
      if (!locationPath || !taskName) continue;
      const dateStr = iDate >= 0 ? row[iDate] : "";
      const occurredAt = parseIsoDate(dateStr);
      if (!occurredAt) {
        errors.push(`Avance fila ${r + 1}: fecha inválida`);
        continue;
      }
      const valRaw = iVal >= 0 ? row[iVal] : "";
      const numVal = Number(valRaw);
      const value = valRaw !== "" && Number.isFinite(numVal) ? numVal : valRaw;
      parsed.progressEvents.push({
        eventId: iId >= 0 && row[iId] ? row[iId] : null,
        locationPath,
        taskName,
        taskParentName: iParent >= 0 ? row[iParent] ?? "" : "",
        value,
        occurredAt,
        userEmail: iUser >= 0 ? row[iUser] ?? "" : "",
        rowNumber: r + 1,
      });
    }
  }

  return { parsed, errors };
}

export function validateParsedWorkbook(
  parsed: ParsedWorkbook,
  expectedProjectId: string,
  expectedTenantId: string
): string[] {
  const errors: string[] = [];
  if (parsed.projectId && parsed.projectId !== expectedProjectId) {
    errors.push(
      `El archivo pertenece al proyecto ${parsed.projectId}, no al proyecto actual ${expectedProjectId}`
    );
  }
  if (parsed.tenantId && parsed.tenantId !== expectedTenantId) {
    errors.push("El archivo pertenece a otro tenant");
  }

  const levelNames = new Set<string>();
  for (const l of parsed.levels) {
    if (levelNames.has(l.name)) errors.push(`Nivel duplicado: "${l.name}"`);
    levelNames.add(l.name);
  }

  const dimNames = new Set<string>();
  for (const d of parsed.dimensions) {
    if (dimNames.has(d.name)) errors.push(`Dimensión duplicada: "${d.name}"`);
    dimNames.add(d.name);
  }

  const taskKeys = new Map<string, number>();
  for (const t of parsed.tasks) {
    const key = `${t.name}\0${t.parentName}`;
    if (taskKeys.has(key)) {
      errors.push(`Tarea duplicada: "${t.name}" (padre: "${t.parentName || "(raíz)"}")`);
    }
    taskKeys.set(key, t.rowNumber);
    if (t.parentName) {
      const parentKey = `${t.parentName}\0`;
      const parentExists = parsed.tasks.some(
        (p) => p.name === t.parentName && p.parentName === ""
      ) || parsed.tasks.some(
        (p) => `${p.name}\0${p.parentName}` === `${t.parentName}\0`
      );
      if (!parentExists && !parsed.tasks.some((p) => p.name === t.parentName)) {
        // parent might be referenced with its own parent - check any task named parentName
        const hasNamedParent = parsed.tasks.some((p) => p.name === t.parentName);
        if (!hasNamedParent) {
          errors.push(`Tarea "${t.name}": tarea_padre "${t.parentName}" no existe en la planilla`);
        }
      }
    }
  }

  return errors;
}
