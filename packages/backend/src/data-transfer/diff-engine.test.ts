import { describe, it, expect } from "vitest";
import { taskRefKey, buildPath, nameToSegment, dimensionCellToBool } from "./constants.js";
import { computeImportState, computeImportDiff } from "./diff-engine.js";
import type { ParsedWorkbook, ProjectSnapshot } from "./types.js";

function emptySnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    tenantId: "tenant-1",
    projectId: "project-1",
    projectName: "Test",
    planVersionId: "plan-1",
    planVersion: 1,
    levels: [],
    dimensions: [],
    tasks: [],
    locations: [],
    assignments: [],
    dependencies: [],
    progressEvents: [],
    ...overrides,
  };
}

function emptyParsed(overrides: Partial<ParsedWorkbook> = {}): ParsedWorkbook {
  return {
    formatVersion: "1.0",
    projectId: "project-1",
    projectName: "Test",
    tenantId: "tenant-1",
    planVersionId: "plan-1",
    levels: [],
    dimensions: [],
    tasks: [],
    locations: [],
    assignments: [],
    dependencies: [],
    progressEvents: [],
    ...overrides,
  };
}

describe("constants", () => {
  it("builds location path from parent", () => {
    expect(buildPath("edificio-1", "piso-3")).toBe("edificio-1/piso-3");
    expect(buildPath(null, "edificio-1")).toBe("edificio-1");
  });

  it("slugifies name segments", () => {
    expect(nameToSegment("Piso 3")).toBe("piso-3");
  });

  it("parses dimension cells", () => {
    expect(dimensionCellToBool("Sí")).toBe(true);
    expect(dimensionCellToBool("")).toBe(false);
  });

  it("creates task ref keys", () => {
    expect(taskRefKey("Columnas", "Estructura")).toBe("Columnas\0Estructura");
  });
});

describe("computeImportDiff", () => {
  it("detects new level create", () => {
    const snapshot = emptySnapshot({
      levels: [{ id: "lvl-1", name: "Piso", order: 0 }],
    });
    const parsed = emptyParsed({
      levels: [
        { systemId: "lvl-1", name: "Piso", order: 0, rowNumber: 2 },
        { systemId: null, name: "Subsuelo", order: -1, rowNumber: 3 },
      ],
    });

    const { sessionChanges, errors } = computeImportDiff(parsed, snapshot, "user-1");
    expect(errors).toEqual([]);
    const creates = sessionChanges.filter((c) => c.action === "create");
    expect(creates.some((c) => c.entity === "locationLevel" && c.label.includes("Subsuelo"))).toBe(
      true
    );
  });

  it("detects level delete when missing from import", () => {
    const snapshot = emptySnapshot({
      levels: [
        { id: "lvl-1", name: "Piso", order: 0 },
        { id: "lvl-2", name: "Subsuelo", order: -1 },
      ],
    });
    const parsed = emptyParsed({
      levels: [{ systemId: "lvl-1", name: "Piso", order: 0, rowNumber: 2 }],
    });

    const { sessionChanges } = computeImportDiff(parsed, snapshot, "user-1");
    const deletes = sessionChanges.filter((c) => c.action === "delete" && c.entity === "locationLevel");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].label).toContain("Subsuelo");
  });

  it("detects task update when dimension values change", () => {
    const snapshot = emptySnapshot({
      dimensions: [{ id: "dim-1", name: "Proveedor", order: 0 }],
      tasks: [
        {
          id: "task-1",
          name: "Instalación",
          parentTaskDefinitionId: null,
          progressValueType: "percent",
          quantityUnit: null,
          stateOptions: null,
          dimensionValues: null,
        },
      ],
    });
    const parsed = emptyParsed({
      dimensions: [{ systemId: "dim-1", name: "Proveedor", order: 0, rowNumber: 2 }],
      tasks: [
        {
          systemId: "task-1",
          name: "Instalación",
          parentName: "",
          progressValueType: "percent",
          quantityUnit: null,
          stateOptions: null,
          dimensionValues: { Proveedor: true },
          rowNumber: 2,
        },
      ],
    });

    const { sessionChanges } = computeImportDiff(parsed, snapshot, "user-1");
    const updates = sessionChanges.filter((c) => c.entity === "task" && c.action === "update");
    expect(updates).toHaveLength(1);
  });

  it("detects progress event delete on replace history", () => {
    const snapshot = emptySnapshot({
      levels: [{ id: "lvl-1", name: "Piso", order: 0 }],
      tasks: [
        {
          id: "task-1",
          name: "Obra",
          parentTaskDefinitionId: null,
          progressValueType: "percent",
          quantityUnit: null,
          stateOptions: null,
          dimensionValues: null,
        },
      ],
      locations: [
        { id: "loc-1", name: "U1", parentId: null, levelId: "lvl-1", path: "u1" },
      ],
      assignments: [{ locationId: "loc-1", taskDefinitionId: "task-1", totalQuantity: null }],
      progressEvents: [
        {
          id: "ev-1",
          taskDefinitionId: "task-1",
          locationId: "loc-1",
          value: 50,
          occurredAt: new Date("2025-01-01T10:00:00.000Z"),
          userId: "user-1",
          userEmail: "planner@test.com",
          sequence: 1,
        },
      ],
    });

    const parsed = emptyParsed({
      levels: [{ systemId: "lvl-1", name: "Piso", order: 0, rowNumber: 2 }],
      tasks: [
        {
          systemId: "task-1",
          name: "Obra",
          parentName: "",
          progressValueType: "percent",
          quantityUnit: null,
          stateOptions: null,
          dimensionValues: {},
          rowNumber: 2,
        },
      ],
      locations: [
        {
          systemId: "loc-1",
          name: "U1",
          levelName: "Piso",
          parentPath: "",
          rowNumber: 2,
        },
      ],
      assignments: [
        {
          locationPath: "u1",
          taskName: "Obra",
          taskParentName: "",
          totalQuantity: null,
          rowNumber: 2,
        },
      ],
      progressEvents: [],
    });

    const { sessionChanges } = computeImportDiff(parsed, snapshot, "user-1");
    const deletes = sessionChanges.filter(
      (c) => c.entity === "progressEvent" && c.action === "delete"
    );
    expect(deletes).toHaveLength(1);
  });
});

describe("computeImportState", () => {
  it("reports broken location level reference", () => {
    const snapshot = emptySnapshot();
    const parsed = emptyParsed({
      locations: [
        {
          systemId: null,
          name: "U1",
          levelName: "Inexistente",
          parentPath: "",
          rowNumber: 2,
        },
      ],
    });
    const state = computeImportState(parsed, snapshot);
    expect(state.errors.some((e) => e.includes("Inexistente"))).toBe(true);
  });
});
