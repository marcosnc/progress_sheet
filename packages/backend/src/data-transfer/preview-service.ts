import type { ImportPreview, ChangeEntity } from "@progress-sheet/shared";
import { parseWorkbook, validateParsedWorkbook } from "./import-parser.js";
import { computeImportDiff } from "./diff-engine.js";
import { loadProjectSnapshot } from "./load-project-snapshot.js";
import { storeImportSession } from "./session-store.js";

export async function previewImport(
  tenantId: string,
  projectId: string,
  userId: string,
  fileBuffer: Buffer
): Promise<ImportPreview> {
  const snapshot = await loadProjectSnapshot(tenantId, projectId);
  if (!snapshot) throw new Error("Project not found");

  const { parsed, errors: parseErrors } = await parseWorkbook(fileBuffer);
  const validationErrors = validateParsedWorkbook(parsed, projectId, tenantId);
  const allErrors = [...parseErrors, ...validationErrors];

  if (allErrors.length > 0) {
    return {
      sessionId: "",
      changes: [],
      errors: allErrors,
      summary: { creates: 0, updates: 0, deletes: 0, total: 0 },
    };
  }

  const { sessionChanges, errors: diffErrors } = computeImportDiff(parsed, snapshot, userId);
  if (diffErrors.length > 0) {
    return {
      sessionId: "",
      changes: [],
      errors: diffErrors,
      summary: { creates: 0, updates: 0, deletes: 0, total: 0 },
    };
  }

  const sessionId = storeImportSession({
    tenantId,
    projectId,
    userId,
    createdAt: new Date(),
    changes: sessionChanges,
  });

  const creates = sessionChanges.filter((c) => c.action === "create").length;
  const updates = sessionChanges.filter((c) => c.action === "update").length;
  const deletes = sessionChanges.filter((c) => c.action === "delete").length;

  return {
    sessionId,
    changes: sessionChanges.map(({ payload: _p, ...rest }) => ({
      ...rest,
      entity: rest.entity as ChangeEntity,
    })),
    errors: [],
    summary: {
      creates,
      updates,
      deletes,
      total: sessionChanges.length,
    },
  };
}
