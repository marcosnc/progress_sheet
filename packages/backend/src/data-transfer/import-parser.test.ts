import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseWorkbook, validateParsedWorkbook } from "./import-parser.js";
import { SHEET_NAMES, METADATA_KEYS, DATA_TRANSFER_FORMAT_VERSION } from "./constants.js";

async function buildMinimalWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const meta = workbook.addWorksheet(SHEET_NAMES.metadata);
  meta.addRow(["clave", "valor"]);
  meta.addRow([METADATA_KEYS.formatVersion, DATA_TRANSFER_FORMAT_VERSION]);
  meta.addRow([METADATA_KEYS.projectId, "project-1"]);
  meta.addRow([METADATA_KEYS.tenantId, "tenant-1"]);

  const levels = workbook.addWorksheet(SHEET_NAMES.levels);
  levels.addRow(["id_sistema", "nombre", "orden"]);
  levels.addRow(["", "Piso", 0]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

describe("parseWorkbook", () => {
  it("parses niveles from minimal workbook", async () => {
    const buffer = await buildMinimalWorkbook();
    const { parsed, errors } = await parseWorkbook(buffer);
    expect(errors.filter((e) => !e.includes("Falta"))).toEqual([]);
    expect(parsed.levels).toHaveLength(1);
    expect(parsed.levels[0].name).toBe("Piso");
    expect(parsed.levels[0].order).toBe(0);
  });

  it("detects duplicate level names in validation", () => {
    const parsed = {
      formatVersion: "1.0",
      projectId: "project-1",
      projectName: null,
      tenantId: "tenant-1",
      planVersionId: null,
      levels: [
        { systemId: null, name: "Piso", order: 0, rowNumber: 2 },
        { systemId: null, name: "Piso", order: 1, rowNumber: 3 },
      ],
      dimensions: [],
      tasks: [],
      locations: [],
      assignments: [],
      dependencies: [],
      progressEvents: [],
    };
    const errors = validateParsedWorkbook(parsed, "project-1", "tenant-1");
    expect(errors.some((e) => e.includes("duplicado"))).toBe(true);
  });

  it("rejects wrong project id", () => {
    const parsed = {
      formatVersion: "1.0",
      projectId: "other-project",
      projectName: null,
      tenantId: "tenant-1",
      planVersionId: null,
      levels: [],
      dimensions: [],
      tasks: [],
      locations: [],
      assignments: [],
      dependencies: [],
      progressEvents: [],
    };
    const errors = validateParsedWorkbook(parsed, "project-1", "tenant-1");
    expect(errors.some((e) => e.includes("proyecto"))).toBe(true);
  });
});
