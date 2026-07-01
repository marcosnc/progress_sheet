import { buildPath, nameToSegment, taskRefKey } from "./constants.js";
import type { ParsedWorkbook, ProjectSnapshot, StoredImportSession } from "./types.js";
import { getTaskParentName } from "./load-project-snapshot.js";

export interface ComputedImportState {
  levelIdByName: Map<string, string>;
  dimensionIdByName: Map<string, string>;
  taskIdByRef: Map<string, string>;
  locationIdByPath: Map<string, string>;
  importLocationPaths: Map<string, string>;
  errors: string[];
}

function resolveTaskRef(
  name: string,
  parentName: string,
  taskIdByRef: Map<string, string>,
  errors: string[],
  context: string
): string | null {
  const key = taskRefKey(name, parentName);
  const id = taskIdByRef.get(key);
  if (!id) errors.push(`${context}: tarea "${name}" (padre: "${parentName || "(raíz)"}") no encontrada`);
  return id ?? null;
}

export function computeImportState(
  parsed: ParsedWorkbook,
  snapshot: ProjectSnapshot
): ComputedImportState {
  const errors: string[] = [];
  const levelIdByName = new Map<string, string>();
  const dimensionIdByName = new Map<string, string>();
  const taskIdByRef = new Map<string, string>();
  const locationIdByPath = new Map<string, string>();
  const importLocationPaths = new Map<string, string>();

  for (const level of snapshot.levels) levelIdByName.set(level.name, level.id);
  for (const dim of snapshot.dimensions) dimensionIdByName.set(dim.name, dim.id);

  for (const level of parsed.levels) {
    if (level.systemId && snapshot.levels.some((l) => l.id === level.systemId)) {
      levelIdByName.set(level.name, level.systemId);
    } else if (!levelIdByName.has(level.name)) {
      levelIdByName.set(level.name, `__new__:${level.name}`);
    }
  }

  for (const dim of parsed.dimensions) {
    if (dim.systemId && snapshot.dimensions.some((d) => d.id === dim.systemId)) {
      dimensionIdByName.set(dim.name, dim.systemId);
    } else if (!dimensionIdByName.has(dim.name)) {
      dimensionIdByName.set(dim.name, `__new__:${dim.name}`);
    }
  }

  for (const task of snapshot.tasks) {
    taskIdByRef.set(
      taskRefKey(task.name, getTaskParentName(task.id, snapshot.tasks)),
      task.id
    );
  }

  const sortedTasks = [...parsed.tasks].sort((a, b) => {
    if (a.parentName && !b.parentName) return 1;
    if (!a.parentName && b.parentName) return -1;
    return 0;
  });

  for (const task of sortedTasks) {
    const key = taskRefKey(task.name, task.parentName);
    if (task.systemId && snapshot.tasks.some((t) => t.id === task.systemId)) {
      taskIdByRef.set(key, task.systemId);
    } else if (!taskIdByRef.has(key)) {
      taskIdByRef.set(key, `__new__:${key}`);
    }
  }

  for (const loc of snapshot.locations) {
    locationIdByPath.set(loc.path, loc.id);
  }

  const pathToParsed = new Map<string, (typeof parsed.locations)[0]>();
  for (const loc of parsed.locations) {
    const segment = nameToSegment(loc.name);
    const path = loc.parentPath ? buildPath(loc.parentPath, segment) : segment;
    importLocationPaths.set(loc.systemId ?? `row:${loc.rowNumber}`, path);
    pathToParsed.set(path, loc);

    if (loc.systemId && snapshot.locations.some((l) => l.id === loc.systemId)) {
      locationIdByPath.set(path, loc.systemId);
    } else if (!locationIdByPath.has(path)) {
      locationIdByPath.set(path, `__new__:${path}`);
    }
  }

  for (const loc of parsed.locations) {
    if (!levelIdByName.has(loc.levelName)) {
      errors.push(`Ubicaciones fila ${loc.rowNumber}: nivel "${loc.levelName}" no existe`);
    }
    if (loc.parentPath && !locationIdByPath.has(loc.parentPath)) {
      errors.push(`Ubicaciones fila ${loc.rowNumber}: ubicacion_padre "${loc.parentPath}" no existe`);
    }
  }

  for (const a of parsed.assignments) {
    if (!locationIdByPath.has(a.locationPath)) {
      errors.push(`Asignaciones fila ${a.rowNumber}: ubicación "${a.locationPath}" no existe`);
    }
    resolveTaskRef(a.taskName, a.taskParentName, taskIdByRef, errors, `Asignaciones fila ${a.rowNumber}`);
  }

  for (const d of parsed.dependencies) {
    resolveTaskRef(d.taskName, d.taskParentName, taskIdByRef, errors, `Dependencias fila ${d.rowNumber}`);
    resolveTaskRef(
      d.dependsOnName,
      d.dependsOnParentName,
      taskIdByRef,
      errors,
      `Dependencias fila ${d.rowNumber}`
    );
  }

  for (const ev of parsed.progressEvents) {
    if (!locationIdByPath.has(ev.locationPath)) {
      errors.push(`Avance fila ${ev.rowNumber}: ubicación "${ev.locationPath}" no existe`);
    }
    resolveTaskRef(ev.taskName, ev.taskParentName, taskIdByRef, errors, `Avance fila ${ev.rowNumber}`);
  }

  return {
    levelIdByName,
    dimensionIdByName,
    taskIdByRef,
    locationIdByPath,
    importLocationPaths,
    errors,
  };
}

export function computeImportDiff(
  parsed: ParsedWorkbook,
  snapshot: ProjectSnapshot,
  importUserId: string
): { sessionChanges: StoredImportSession["changes"]; errors: string[] } {
  const state = computeImportState(parsed, snapshot);
  if (state.errors.length > 0) return { sessionChanges: [], errors: state.errors };

  const changes: StoredImportSession["changes"] = [];
  const addChange = (change: StoredImportSession["changes"][0]) => {
    changes.push(change);
  };

  const snapshotLevelById = new Map(snapshot.levels.map((l) => [l.id, l]));
  const parsedLevelByKey = new Map<string, ParsedWorkbook["levels"][0]>();
  for (const l of parsed.levels) {
    const id = l.systemId && snapshotLevelById.has(l.systemId) ? l.systemId : l.name;
    parsedLevelByKey.set(id, l);
  }

  for (const level of parsed.levels) {
    const existing = level.systemId
      ? snapshot.levels.find((l) => l.id === level.systemId)
      : snapshot.levels.find((l) => l.name === level.name);
    if (!existing) {
      addChange({
        id: crypto.randomUUID(),
        entity: "locationLevel",
        action: "create",
        label: `Crear nivel "${level.name}"`,
        payload: {
          entity: "locationLevel",
          action: "create",
          data: { name: level.name, order: level.order },
        },
      });
    } else if (existing.name !== level.name || existing.order !== level.order) {
      const fieldChanges: { field: string; before: unknown; after: unknown }[] = [];
      if (existing.name !== level.name) fieldChanges.push({ field: "nombre", before: existing.name, after: level.name });
      if (existing.order !== level.order) fieldChanges.push({ field: "orden", before: existing.order, after: level.order });
      addChange({
        id: crypto.randomUUID(),
        entity: "locationLevel",
        action: "update",
        label: `Actualizar nivel "${existing.name}"`,
        fieldChanges,
        payload: {
          entity: "locationLevel",
          action: "update",
          data: { id: existing.id, name: level.name, order: level.order },
        },
      });
    }
  }

  for (const existing of snapshot.levels) {
    const inImport = parsed.levels.some(
      (l) => l.systemId === existing.id || l.name === existing.name
    );
    if (!inImport) {
      const locCount = snapshot.locations.filter((loc) => {
        const level = snapshot.levels.find((lv) => lv.id === loc.levelId);
        return level?.id === existing.id;
      }).length;
      addChange({
        id: crypto.randomUUID(),
        entity: "locationLevel",
        action: "delete",
        label: `Eliminar nivel "${existing.name}"`,
        warnings: locCount > 0 ? [`${locCount} ubicación(es) usan este nivel`] : undefined,
        payload: {
          entity: "locationLevel",
          action: "delete",
          data: { id: existing.id },
        },
      });
    }
  }

  for (const dim of parsed.dimensions) {
    const existing = dim.systemId
      ? snapshot.dimensions.find((d) => d.id === dim.systemId)
      : snapshot.dimensions.find((d) => d.name === dim.name);
    if (!existing) {
      addChange({
        id: crypto.randomUUID(),
        entity: "dimension",
        action: "create",
        label: `Crear dimensión "${dim.name}"`,
        payload: {
          entity: "dimension",
          action: "create",
          data: { name: dim.name, order: dim.order },
        },
      });
    } else if (existing.name !== dim.name || existing.order !== dim.order) {
      const fieldChanges: { field: string; before: unknown; after: unknown }[] = [];
      if (existing.name !== dim.name) fieldChanges.push({ field: "nombre", before: existing.name, after: dim.name });
      if (existing.order !== dim.order) fieldChanges.push({ field: "orden", before: existing.order, after: dim.order });
      addChange({
        id: crypto.randomUUID(),
        entity: "dimension",
        action: "update",
        label: `Actualizar dimensión "${existing.name}"`,
        fieldChanges,
        payload: {
          entity: "dimension",
          action: "update",
          data: { id: existing.id, name: dim.name, order: dim.order },
        },
      });
    }
  }

  for (const existing of snapshot.dimensions) {
    const inImport = parsed.dimensions.some(
      (d) => d.systemId === existing.id || d.name === existing.name
    );
    if (!inImport) {
      addChange({
        id: crypto.randomUUID(),
        entity: "dimension",
        action: "delete",
        label: `Eliminar dimensión "${existing.name}"`,
        payload: {
          entity: "dimension",
          action: "delete",
          data: { id: existing.id },
        },
      });
    }
  }

  const mergedDimNames = new Map<string, string>();
  for (const d of snapshot.dimensions) mergedDimNames.set(d.name, d.id);
  for (const d of parsed.dimensions) {
    if (!mergedDimNames.has(d.name)) mergedDimNames.set(d.name, `__new__:${d.name}`);
  }

  for (const task of parsed.tasks) {
    const parentKey = taskRefKey(task.parentName, "");
    let parentId: string | null = null;
    if (task.parentName) {
      const parentTask = parsed.tasks.find(
        (t) => t.name === task.parentName && (task.parentName === t.name || t.parentName === "")
      );
      const parentRef = parsed.tasks.filter((t) => t.name === task.parentName);
      if (parentRef.length === 1) {
        parentId = state.taskIdByRef.get(taskRefKey(parentRef[0].name, parentRef[0].parentName)) ?? null;
      } else if (parentRef.length > 1) {
        const exact = parsed.tasks.find((t) => taskRefKey(t.name, t.parentName) === taskRefKey(task.parentName, ""));
        if (exact) parentId = state.taskIdByRef.get(taskRefKey(exact.name, exact.parentName)) ?? null;
      }
    }

    const dimValues: Record<string, string> = {};
    for (const [dimName, selected] of Object.entries(task.dimensionValues)) {
      if (selected) {
        const dimId = state.dimensionIdByName.get(dimName);
        if (dimId && !dimId.startsWith("__new__:")) dimValues[dimId] = "1";
      }
    }

    const existing = task.systemId
      ? snapshot.tasks.find((t) => t.id === task.systemId)
      : snapshot.tasks.find(
          (t) =>
            t.name === task.name &&
            getTaskParentName(t.id, snapshot.tasks) === task.parentName
        );

    const stateOptionsJson = task.stateOptions ? JSON.stringify(task.stateOptions) : null;
    const dimValuesJson = Object.keys(dimValues).length > 0 ? JSON.stringify(dimValues) : null;

    if (!existing) {
      addChange({
        id: crypto.randomUUID(),
        entity: "task",
        action: "create",
        label: `Crear tarea "${task.name}"`,
        payload: {
          entity: "task",
          action: "create",
          data: {
            refKey: taskRefKey(task.name, task.parentName),
            name: task.name,
            parentName: task.parentName,
            progressValueType: task.progressValueType,
            quantityUnit: task.quantityUnit,
            stateOptions: stateOptionsJson,
            dimensionValues: dimValuesJson,
          },
        },
      });
    } else {
      const existingParentName = getTaskParentName(existing.id, snapshot.tasks);
      const fieldChanges: { field: string; before: unknown; after: unknown }[] = [];
      if (existing.name !== task.name) fieldChanges.push({ field: "nombre", before: existing.name, after: task.name });
      if (existingParentName !== task.parentName)
        fieldChanges.push({ field: "tarea_padre", before: existingParentName, after: task.parentName });
      if (existing.progressValueType !== task.progressValueType)
        fieldChanges.push({ field: "tipo_avance", before: existing.progressValueType, after: task.progressValueType });
      if ((existing.quantityUnit ?? "") !== (task.quantityUnit ?? ""))
        fieldChanges.push({ field: "unidad_cantidad", before: existing.quantityUnit, after: task.quantityUnit });
      if ((existing.stateOptions ?? "") !== (stateOptionsJson ?? ""))
        fieldChanges.push({ field: "opciones_estado", before: existing.stateOptions, after: stateOptionsJson });
      if ((existing.dimensionValues ?? "") !== (dimValuesJson ?? ""))
        fieldChanges.push({ field: "dimensiones", before: existing.dimensionValues, after: dimValuesJson });

      if (fieldChanges.length > 0) {
        addChange({
          id: crypto.randomUUID(),
          entity: "task",
          action: "update",
          label: `Actualizar tarea "${existing.name}"`,
          fieldChanges,
          payload: {
            entity: "task",
            action: "update",
            data: {
              id: existing.id,
              refKey: taskRefKey(task.name, task.parentName),
              name: task.name,
              parentName: task.parentName,
              progressValueType: task.progressValueType,
              quantityUnit: task.quantityUnit,
              stateOptions: stateOptionsJson,
              dimensionValues: dimValuesJson,
            },
          },
        });
      }
    }
  }

  for (const existing of snapshot.tasks) {
    const parentName = getTaskParentName(existing.id, snapshot.tasks);
    const inImport = parsed.tasks.some(
      (t) =>
        t.systemId === existing.id ||
        (t.name === existing.name && t.parentName === parentName)
    );
    if (!inImport) {
      addChange({
        id: crypto.randomUUID(),
        entity: "task",
        action: "delete",
        label: `Eliminar tarea "${existing.name}"`,
        warnings: ["Se eliminarán asignaciones y eventos de avance asociados"],
        payload: {
          entity: "task",
          action: "delete",
          data: { id: existing.id },
        },
      });
    }
  }

  for (const loc of parsed.locations) {
    const segment = nameToSegment(loc.name);
    const path = loc.parentPath ? buildPath(loc.parentPath, segment) : segment;
    const levelId = state.levelIdByName.get(loc.levelName);
    const existing = loc.systemId
      ? snapshot.locations.find((l) => l.id === loc.systemId)
      : snapshot.locations.find((l) => l.path === path);

    if (!existing) {
      addChange({
        id: crypto.randomUUID(),
        entity: "location",
        action: "create",
        label: `Crear ubicación "${loc.name}" (${path})`,
        payload: {
          entity: "location",
          action: "create",
          data: {
            name: loc.name,
            levelName: loc.levelName,
            parentPath: loc.parentPath,
            path,
          },
        },
      });
    } else {
      const existingLevelName = snapshot.levels.find((l) => l.id === existing.levelId)?.name ?? "";
      const existingParentPath = existing.parentId
        ? (snapshot.locations.find((l) => l.id === existing.parentId)?.path ?? "")
        : "";
      const fieldChanges: { field: string; before: unknown; after: unknown }[] = [];
      if (existing.name !== loc.name) fieldChanges.push({ field: "nombre", before: existing.name, after: loc.name });
      if (existingLevelName !== loc.levelName)
        fieldChanges.push({ field: "nivel", before: existingLevelName, after: loc.levelName });
      if (existingParentPath !== loc.parentPath)
        fieldChanges.push({ field: "ubicacion_padre", before: existingParentPath, after: loc.parentPath });

      if (fieldChanges.length > 0) {
        addChange({
          id: crypto.randomUUID(),
          entity: "location",
          action: "update",
          label: `Actualizar ubicación "${existing.name}"`,
          fieldChanges,
          payload: {
            entity: "location",
            action: "update",
            data: {
              id: existing.id,
              name: loc.name,
              levelName: loc.levelName,
              parentPath: loc.parentPath,
              path,
            },
          },
        });
      }
    }
  }

  for (const existing of snapshot.locations) {
    const inImport = parsed.locations.some((l) => {
      const segment = nameToSegment(l.name);
      const path = l.parentPath ? buildPath(l.parentPath, segment) : segment;
      return l.systemId === existing.id || path === existing.path;
    });
    if (!inImport) {
      addChange({
        id: crypto.randomUUID(),
        entity: "location",
        action: "delete",
        label: `Eliminar ubicación "${existing.name}" (${existing.path})`,
        warnings: ["Se eliminará el subárbol y asignaciones asociadas"],
        payload: {
          entity: "location",
          action: "delete",
          data: { id: existing.id, path: existing.path },
        },
      });
    }
  }

  const assignmentKey = (locationPath: string, taskName: string, taskParentName: string) =>
    `${locationPath}\0${taskRefKey(taskName, taskParentName)}`;

  const importAssignments = new Set<string>();
  for (const a of parsed.assignments) {
    importAssignments.add(assignmentKey(a.locationPath, a.taskName, a.taskParentName));
    const locId = state.locationIdByPath.get(a.locationPath);
    const taskId = state.taskIdByRef.get(taskRefKey(a.taskName, a.taskParentName));
    if (!locId || !taskId) continue;

    const existing = snapshot.assignments.find(
      (x) =>
        (snapshot.locations.find((l) => l.id === x.locationId)?.path ?? "") === a.locationPath &&
        (() => {
          const t = snapshot.tasks.find((t) => t.id === x.taskDefinitionId);
          return t
            ? taskRefKey(t.name, getTaskParentName(t.id, snapshot.tasks)) ===
                taskRefKey(a.taskName, a.taskParentName)
            : false;
        })()
    );

    if (!existing) {
      addChange({
        id: crypto.randomUUID(),
        entity: "assignment",
        action: "create",
        label: `Asignar "${a.taskName}" en "${a.locationPath}"`,
        payload: {
          entity: "assignment",
          action: "create",
          data: {
            locationPath: a.locationPath,
            taskName: a.taskName,
            taskParentName: a.taskParentName,
            totalQuantity: a.totalQuantity,
          },
        },
      });
    } else if ((existing.totalQuantity ?? null) !== (a.totalQuantity ?? null)) {
      addChange({
        id: crypto.randomUUID(),
        entity: "assignment",
        action: "update",
        label: `Actualizar cantidad en "${a.taskName}" @ "${a.locationPath}"`,
        fieldChanges: [
          {
            field: "cantidad_total",
            before: existing.totalQuantity,
            after: a.totalQuantity,
          },
        ],
        payload: {
          entity: "assignment",
          action: "update",
          data: {
            locationPath: a.locationPath,
            taskName: a.taskName,
            taskParentName: a.taskParentName,
            totalQuantity: a.totalQuantity,
          },
        },
      });
    }
  }

  for (const existing of snapshot.assignments) {
    const loc = snapshot.locations.find((l) => l.id === existing.locationId);
    const task = snapshot.tasks.find((t) => t.id === existing.taskDefinitionId);
    if (!loc || !task) continue;
    const key = assignmentKey(
      loc.path,
      task.name,
      getTaskParentName(task.id, snapshot.tasks)
    );
    if (!importAssignments.has(key)) {
      addChange({
        id: crypto.randomUUID(),
        entity: "assignment",
        action: "delete",
        label: `Quitar asignación "${task.name}" en "${loc.path}"`,
        payload: {
          entity: "assignment",
          action: "delete",
          data: {
            locationPath: loc.path,
            taskName: task.name,
            taskParentName: getTaskParentName(task.id, snapshot.tasks),
          },
        },
      });
    }
  }

  const depKey = (t: string, tp: string, d: string, dp: string) =>
    `${taskRefKey(t, tp)}\0${taskRefKey(d, dp)}`;
  const importDeps = new Set<string>();

  for (const d of parsed.dependencies) {
    importDeps.add(depKey(d.taskName, d.taskParentName, d.dependsOnName, d.dependsOnParentName));
    const taskId = state.taskIdByRef.get(taskRefKey(d.taskName, d.taskParentName));
    const depId = state.taskIdByRef.get(taskRefKey(d.dependsOnName, d.dependsOnParentName));
    if (!taskId || !depId) continue;

    const existing = snapshot.dependencies.find(
      (x) => x.taskId === taskId && x.dependsOnTaskId === depId
    );
    if (!existing) {
      addChange({
        id: crypto.randomUUID(),
        entity: "dependency",
        action: "create",
        label: `Dependencia: "${d.taskName}" depende de "${d.dependsOnName}"`,
        payload: {
          entity: "dependency",
          action: "create",
          data: {
            taskName: d.taskName,
            taskParentName: d.taskParentName,
            dependsOnName: d.dependsOnName,
            dependsOnParentName: d.dependsOnParentName,
          },
        },
      });
    }
  }

  for (const existing of snapshot.dependencies) {
    const task = snapshot.tasks.find((t) => t.id === existing.taskId);
    const dep = snapshot.tasks.find((t) => t.id === existing.dependsOnTaskId);
    if (!task || !dep) continue;
    const key = depKey(
      task.name,
      getTaskParentName(task.id, snapshot.tasks),
      dep.name,
      getTaskParentName(dep.id, snapshot.tasks)
    );
    if (!importDeps.has(key)) {
      addChange({
        id: crypto.randomUUID(),
        entity: "dependency",
        action: "delete",
        label: `Eliminar dependencia: "${task.name}" → "${dep.name}"`,
        payload: {
          entity: "dependency",
          action: "delete",
          data: { id: existing.id },
        },
      });
    }
  }

  const progressKey = (ev: {
    locationPath: string;
    taskName: string;
    taskParentName: string;
    occurredAt: Date;
    value: number | string;
  }) =>
    `${ev.locationPath}\0${taskRefKey(ev.taskName, ev.taskParentName)}\0${ev.occurredAt.toISOString()}\0${ev.value}`;

  const importProgressByEventId = new Map<string, ParsedWorkbook["progressEvents"][0]>();
  for (const ev of parsed.progressEvents) {
    if (ev.eventId) importProgressByEventId.set(ev.eventId, ev);
  }

  for (const ev of parsed.progressEvents) {
    const existing = ev.eventId
      ? snapshot.progressEvents.find((e) => e.id === ev.eventId)
      : undefined;

    if (!existing) {
      addChange({
        id: crypto.randomUUID(),
        entity: "progressEvent",
        action: "create",
        label: `Registrar avance: "${ev.taskName}" @ "${ev.locationPath}" (${ev.occurredAt.toISOString()})`,
        payload: {
          entity: "progressEvent",
          action: "create",
          data: {
            locationPath: ev.locationPath,
            taskName: ev.taskName,
            taskParentName: ev.taskParentName,
            value: ev.value,
            occurredAt: ev.occurredAt.toISOString(),
            userEmail: ev.userEmail,
            fallbackUserId: importUserId,
          },
        },
      });
    } else {
      const loc = snapshot.locations.find((l) => l.id === existing.locationId);
      const task = snapshot.tasks.find((t) => t.id === existing.taskDefinitionId);
      const fieldChanges: { field: string; before: unknown; after: unknown }[] = [];
      if (loc && loc.path !== ev.locationPath)
        fieldChanges.push({ field: "ubicacion", before: loc.path, after: ev.locationPath });
      if (task && task.name !== ev.taskName)
        fieldChanges.push({ field: "tarea", before: task.name, after: ev.taskName });
      if (existing.value !== ev.value)
        fieldChanges.push({ field: "valor", before: existing.value, after: ev.value });
      if (existing.occurredAt.getTime() !== ev.occurredAt.getTime())
        fieldChanges.push({
          field: "fecha",
          before: existing.occurredAt.toISOString(),
          after: ev.occurredAt.toISOString(),
        });

      if (fieldChanges.length > 0) {
        addChange({
          id: crypto.randomUUID(),
          entity: "progressEvent",
          action: "update",
          label: `Actualizar evento de avance ${ev.eventId?.slice(0, 8) ?? ""}`,
          fieldChanges,
          payload: {
            entity: "progressEvent",
            action: "update",
            data: {
              id: existing.id,
              locationPath: ev.locationPath,
              taskName: ev.taskName,
              taskParentName: ev.taskParentName,
              value: ev.value,
              occurredAt: ev.occurredAt.toISOString(),
              userEmail: ev.userEmail,
              fallbackUserId: importUserId,
            },
          },
        });
      }
    }
  }

  for (const existing of snapshot.progressEvents) {
    if (!importProgressByEventId.has(existing.id)) {
      const loc = snapshot.locations.find((l) => l.id === existing.locationId);
      const task = snapshot.tasks.find((t) => t.id === existing.taskDefinitionId);
      addChange({
        id: crypto.randomUUID(),
        entity: "progressEvent",
        action: "delete",
        label: `Eliminar evento de avance: "${task?.name ?? "?"}" @ "${loc?.path ?? "?"}" (${existing.occurredAt.toISOString()})`,
        payload: {
          entity: "progressEvent",
          action: "delete",
          data: { id: existing.id },
        },
      });
    }
  }

  return { sessionChanges: changes, errors: [] };
}
