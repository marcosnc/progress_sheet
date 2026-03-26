"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  projectsApi,
  plansApi,
  progressApi,
  projectionsApi,
  locationLevelsApi,
  locationsApi,
  dimensionsApi,
} from "@/lib/api";

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskType, setNewTaskType] = useState<"percent" | "quantity" | "state">("percent");
  const [newTaskUnit, setNewTaskUnit] = useState("");
  const [newTaskParentTaskId, setNewTaskParentTaskId] = useState<string>("");
  const [showAddTask, setShowAddTask] = useState(false);

  const [newLocName, setNewLocName] = useState("");
  const [newLocParentId, setNewLocParentId] = useState<string>("");
  const [newLocLevelId, setNewLocLevelId] = useState("");
  const [newLocTaskIds, setNewLocTaskIds] = useState<string[]>([]);
  const [showAddLoc, setShowAddLoc] = useState(false);

  const [replicatePrefix, setReplicatePrefix] = useState("Unidad");
  const [replicateCount, setReplicateCount] = useState(5);
  const [replicateParentId, setReplicateParentId] = useState<string>("");
  const [replicateLevelId, setReplicateLevelId] = useState("");
  const [replicateTaskIds, setReplicateTaskIds] = useState<string[]>([]);
  const [showReplicate, setShowReplicate] = useState(false);

  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editLocName, setEditLocName] = useState("");
  const [editLocTaskIds, setEditLocTaskIds] = useState<string[]>([]);

  const [replicatingFromLocationId, setReplicatingFromLocationId] = useState<string | null>(null);
  const [replicateFromCount, setReplicateFromCount] = useState(2);
  const [replicateFromPrefix, setReplicateFromPrefix] = useState("");

  const [newLevelName, setNewLevelName] = useState("");
  const [newLevelOrder, setNewLevelOrder] = useState(0);
  const [showAddLevel, setShowAddLevel] = useState(false);

  const [selectedDimensionIds, setSelectedDimensionIds] = useState<Record<string, boolean>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newDimName, setNewDimName] = useState("");
  const [newDimKey, setNewDimKey] = useState("");
  const [showAddDim, setShowAddDim] = useState(false);

  const [progressTaskId, setProgressTaskId] = useState("");
  const [progressLocationId, setProgressLocationId] = useState("");
  const [progressValue, setProgressValue] = useState("");
  const [showRecordProgress, setShowRecordProgress] = useState(false);

  const [activeCategory, setActiveCategory] = useState<"planificacion" | "registro" | "consulta">("planificacion");
  const [activePlanningTab, setActivePlanningTab] = useState<
    "espacial" | "tareas" | "dimensiones" | "asignaciones" | "validacion"
  >("espacial");

  // Para la pantalla "Asignaciones": editar el set de tareas asociadas a una ubicación
  const [assignmentLocationId, setAssignmentLocationId] = useState("");
  const [assignmentTaskIds, setAssignmentTaskIds] = useState<string[]>([]);

  // Filtro UX para la pantalla "Consulta de estado" por dimensión
  const [dimensionFilterId, setDimensionFilterId] = useState<string>("");

  // Vista de tareas: lista o jerarquía
  const [tasksViewMode, setTasksViewMode] = useState<"lista" | "jerarquia">("lista");

  // Árbol jerárquico: qué nodos están expandidos
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
  });
  const { data: plans } = useQuery({
    queryKey: ["plans", id],
    queryFn: () => plansApi.list(id),
    enabled: !!project,
  });
  const { data: locationsData } = useQuery({
    queryKey: ["locations", id],
    queryFn: () => locationsApi.list(id),
    enabled: !!project,
  });
  const { data: levelsData } = useQuery({
    queryKey: ["location-levels"],
    queryFn: () => locationLevelsApi.list(),
    enabled: !!project,
  });
  const { data: progress } = useQuery({
    queryKey: ["progress", id],
    queryFn: () => progressApi.getState(id),
    enabled: !!project,
  });
  const { data: velocity } = useQuery({
    queryKey: ["projections", id],
    queryFn: () => projectionsApi.velocity(id),
    enabled: !!project,
  });
  const { data: dimensionsData } = useQuery({
    queryKey: ["dimensions"],
    queryFn: () => dimensionsApi.list(),
    enabled: !!project,
  });

  const createPlan = useMutation({
    mutationFn: () => plansApi.create(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["plans", id] });
      await queryClient.invalidateQueries({ queryKey: ["project", id] });
      await queryClient.refetchQueries({ queryKey: ["plans", id] });
    },
  });

  const buildTaskDimensionValues = () => {
    const dimensionValues: Record<string, string> = {};
    dimensions.filter((d) => selectedDimensionIds[d.id]).forEach((d) => { dimensionValues[d.id] = "1"; });
    return dimensionValues;
  };

  const addTask = useMutation({
    mutationFn: (planId: string) =>
      plansApi.addTask(id, planId, {
        name: newTaskName,
        progressValueType: newTaskType,
        quantityUnit: newTaskType === "quantity" ? newTaskUnit || "m²" : null,
        stateOptions: newTaskType === "state" ? ["pendiente", "en curso", "terminado"] : null,
        dimensionValues: Object.keys(buildTaskDimensionValues()).length ? buildTaskDimensionValues() : undefined,
        parentTaskDefinitionId: newTaskParentTaskId ? newTaskParentTaskId : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["plans", id] });
      await queryClient.refetchQueries({ queryKey: ["plans", id] });
      setNewTaskName("");
      setSelectedDimensionIds({});
      setNewTaskParentTaskId("");
      setShowAddTask(false);
    },
  });

  const updateTask = useMutation({
    mutationFn: ([planId, taskId]: [string, string]) =>
      plansApi.updateTask(id, planId, taskId, {
        name: newTaskName,
        progressValueType: newTaskType,
        quantityUnit: newTaskType === "quantity" ? newTaskUnit || "m²" : null,
        stateOptions: newTaskType === "state" ? ["pendiente", "en curso", "terminado"] : null,
        dimensionValues: buildTaskDimensionValues(),
        parentTaskDefinitionId: newTaskParentTaskId ? newTaskParentTaskId : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["plans", id] });
      await queryClient.refetchQueries({ queryKey: ["plans", id] });
      setNewTaskName("");
      setSelectedDimensionIds({});
      setNewTaskParentTaskId("");
      setShowAddTask(false);
      setEditingTaskId(null);
    },
  });

  const createLevel = useMutation({
    mutationFn: () => locationLevelsApi.create(newLevelName, newLevelOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["location-levels"] });
      setNewLevelName("");
      setNewLevelOrder(levelsData?.levels?.length ?? 0);
      setShowAddLevel(false);
    },
  });

  const deleteLevel = useMutation({
    mutationFn: (levelId: string) => locationLevelsApi.delete(levelId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["location-levels"] });
      await queryClient.refetchQueries({ queryKey: ["location-levels"] });
    },
  });

  const createDimension = useMutation({
    mutationFn: () => {
      const key = newDimKey.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "_");
      if (!key) throw new Error("La clave no puede quedar vacía");
      return dimensionsApi.create({
        name: newDimName.trim(),
        key,
        order: dimensionsData?.dimensions?.length ?? 0,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dimensions"] });
      await queryClient.refetchQueries({ queryKey: ["dimensions"] });
      setNewDimName("");
      setNewDimKey("");
      setShowAddDim(false);
    },
  });

  const deleteDimension = useMutation({
    mutationFn: (dimId: string) => dimensionsApi.delete(dimId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dimensions"] });
    },
  });

  const recordProgress = useMutation({
    mutationFn: () =>
      progressApi.record(id, {
        taskDefinitionId: progressTaskId,
        locationId: progressLocationId,
        value: Number(progressValue) || progressValue,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["progress", id] });
      await queryClient.refetchQueries({ queryKey: ["progress", id] });
      setProgressValue("");
      setShowRecordProgress(false);
    },
  });

  const createLocation = useMutation({
    mutationFn: () =>
      locationsApi.create(id, {
        parentId: newLocParentId || null,
        levelId: newLocLevelId,
        name: newLocName,
        taskDefinitionIds: newLocTaskIds.length ? newLocTaskIds : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      setNewLocName("");
      setNewLocTaskIds([]);
      setShowAddLoc(false);
    },
  });

  const replicateLocations = useMutation({
    mutationFn: () =>
      locationsApi.replicate(id, {
        parentId: replicateParentId || null,
        levelId: replicateLevelId,
        namePrefix: replicatePrefix,
        count: replicateCount,
        taskDefinitionIds: replicateTaskIds.length ? replicateTaskIds : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      setReplicateTaskIds([]);
      setShowReplicate(false);
    },
  });

  const updateLocation = useMutation({
    mutationFn: () =>
      locationsApi.update(id, editingLocationId!, {
        name: editLocName.trim(),
        taskDefinitionIds: editLocTaskIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      setEditingLocationId(null);
      setEditLocName("");
      setEditLocTaskIds([]);
    },
  });

  // Actualiza solo el vínculo "tareas ↔ ubicación" (taskDefinitionIds) sin tocar el nombre.
  const updateLocationTaskDefinitions = useMutation({
    mutationFn: (body: { locationId: string; taskDefinitionIds: string[] }) =>
      locationsApi.update(id, body.locationId, { taskDefinitionIds: body.taskDefinitionIds }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["locations", id] });
      await queryClient.invalidateQueries({ queryKey: ["project", id] });
    },
  });

  const deleteLocation = useMutation({
    mutationFn: (locationId: string) => locationsApi.delete(id, locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
    },
  });

  const replicateFromLocation = useMutation({
    mutationFn: () =>
      locationsApi.replicateFrom(id, replicatingFromLocationId!, {
        count: replicateFromCount,
        namePrefix: replicateFromPrefix.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      setReplicatingFromLocationId(null);
      setReplicateFromCount(2);
      setReplicateFromPrefix("");
    },
  });

  if (isLoading || !project) return <p style={{ padding: "2rem" }}>Cargando...</p>;
  if (error) return <p style={{ padding: "2rem", color: "#ef4444" }}>Error: {String(error)}</p>;

  const currentPlan = plans?.plans?.[0];
  const locations = (locationsData?.locations ?? project?.locations ?? []) as { id: string; name: string; path: string; parentId: string | null; levelId: string; taskDefinitionIds?: string[] }[];
  const progressSelectedLocation = locations.find((l) => l.id === progressLocationId);
  const tasksForProgressLocation = (currentPlan?.taskDefinitions ?? []).filter((t) =>
    progressSelectedLocation?.taskDefinitionIds?.includes(t.id)
  );
  const selectedTaskForProgress = (currentPlan?.taskDefinitions ?? []).find((t) => t.id === progressTaskId);
  const selectedTaskStateOptions = (() => {
    const so: unknown = selectedTaskForProgress?.stateOptions ?? null;
    if (Array.isArray(so)) return so.map(String);
    if (typeof so === "string") {
      try {
        const parsed: unknown = JSON.parse(so);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        // ignore
      }
    }
    return [];
  })();
  const planTaskDefinitions = currentPlan?.taskDefinitions ?? [];
  const usedTaskIdsByLocations = new Set<string>(locations.flatMap((l) => l.taskDefinitionIds ?? []));
  const tasksWithoutLocations = planTaskDefinitions.filter((t) => !usedTaskIdsByLocations.has(t.id));
  const locationsWithoutTasks = locations.filter((l) => (l.taskDefinitionIds?.length ?? 0) === 0);
  const levels = levelsData?.levels ?? [];
  const dimensions = dimensionsData?.dimensions ?? [];
  const taskDimensionIdsByTaskId: Record<string, string[]> = {};
  const taskDimensionNamesByTaskId: Record<string, string[]> = {};
  planTaskDefinitions.forEach((t) => {
    try {
      const dv = t.dimensionValues ? (JSON.parse(t.dimensionValues) as Record<string, string>) : {};
      const selectedDimensionIds = Object.keys(dv).filter((dimId) => !!dv[dimId]);
      taskDimensionIdsByTaskId[t.id] = selectedDimensionIds;
      taskDimensionNamesByTaskId[t.id] = dimensions.filter((d) => selectedDimensionIds.includes(d.id)).map((d) => d.name);
    } catch {
      taskDimensionIdsByTaskId[t.id] = [];
      taskDimensionNamesByTaskId[t.id] = [];
    }
  });
  const items = progress?.items ?? [];
  const projections = velocity?.projections ?? [];

  // Expandir por defecto solo las ramas raíz al cargar/el cambiar de plan.
  useEffect(() => {
    if (!currentPlan) return;
    const roots =
      (currentPlan.taskDefinitions ?? []).filter((t) => (t.parentTaskDefinitionId ?? null) === null).map((t) => t.id);
    setExpandedTaskIds(new Set(roots));
  }, [currentPlan?.id]);

  const filteredItems =
    dimensionFilterId && dimensionFilterId.trim()
      ? items.filter((it) => (taskDimensionIdsByTaskId[it.taskDefinitionId] ?? []).includes(dimensionFilterId))
      : items;

  function startEditingTask(
    t: {
      id: string;
      name: string;
      progressValueType: string;
      quantityUnit?: string | null;
      dimensionValues?: string | null;
      parentTaskDefinitionId?: string | null;
    }
  ) {
    setEditingTaskId(t.id);
    setNewTaskName(t.name);
    setNewTaskType(t.progressValueType as "percent" | "quantity" | "state");
    setNewTaskUnit(t.quantityUnit ?? "");
    setNewTaskParentTaskId(t.parentTaskDefinitionId ?? "");
    try {
      const dv = t.dimensionValues ? (JSON.parse(t.dimensionValues) as Record<string, string>) : {};
      const sel: Record<string, boolean> = {};
      dimensions.forEach((d) => {
        sel[d.id] = !!dv[d.id];
      });
      setSelectedDimensionIds(sel);
    } catch {
      setSelectedDimensionIds({});
    }
    setShowAddTask(true);
  }

  function cancelTaskForm() {
    setShowAddTask(false);
    setEditingTaskId(null);
    setNewTaskName("");
    setSelectedDimensionIds({});
    setNewTaskUnit("");
    setNewTaskParentTaskId("");
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/projects" style={{ color: "var(--muted)", marginBottom: "0.5rem", display: "inline-block" }}>
          ← Proyectos
        </Link>
        <h1 style={{ margin: "0.5rem 0" }}>{project.name}</h1>
      </div>

      {/* Navegación principal por categoría */}
      <nav style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {(
          [
            ["planificacion", "Planificación"],
            ["registro", "Registro de avance"],
            ["consulta", "Consulta de estado"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveCategory(key)}
            style={{
              padding: "0.5rem 0.9rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: activeCategory === key ? "var(--accent)" : "var(--surface)",
              color: activeCategory === key ? "white" : "var(--text)",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Tabs internos para Planificación */}
      {activeCategory === "planificacion" && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {(
            [
              ["espacial", "Espacial"],
              ["tareas", "Tareas"],
              ["dimensiones", "Dimensiones"],
              ["asignaciones", "Asignaciones"],
              ["validacion", "Validación"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActivePlanningTab(key)}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: activePlanningTab === key ? "var(--accent)" : "var(--surface)",
                color: activePlanningTab === key ? "white" : "var(--text)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {activeCategory === "planificacion" && activePlanningTab === "tareas" && (
        <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Plan actual</h2>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setTasksViewMode("lista")}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: tasksViewMode === "lista" ? "var(--accent)" : "var(--surface)",
              color: tasksViewMode === "lista" ? "white" : "var(--text)",
              cursor: "pointer",
            }}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setTasksViewMode("jerarquia")}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: tasksViewMode === "jerarquia" ? "var(--accent)" : "var(--surface)",
              color: tasksViewMode === "jerarquia" ? "white" : "var(--text)",
              cursor: "pointer",
            }}
          >
            Jerarquía
          </button>
        </div>
        {currentPlan ? (
          <>
            <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
              Versión {currentPlan.version} — {currentPlan.taskDefinitions?.length ?? 0} tareas
            </p>
            {(currentPlan.taskDefinitions?.length ?? 0) > 0 && (
              tasksViewMode === "lista" ? (
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem 0" }}>
                  {currentPlan.taskDefinitions?.map((t) => {
                    let tagNames: string[] = [];
                    try {
                      const dv = t.dimensionValues ? JSON.parse(t.dimensionValues) as Record<string, string> : {};
                      tagNames = dimensions.filter((d) => dv[d.id]).map((d) => d.name);
                    } catch {
                      /**/
                    }
                    return (
                      <li
                        key={t.id}
                        style={{
                          padding: "0.5rem",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          marginBottom: 4,
                        }}
                      >
                        {t.name}{" "}
                        <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>({t.progressValueType})</span>
                        {tagNames.length > 0 && (
                          <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}>
                            —{" "}
                            {tagNames.map((n) => (
                              <span
                                key={n}
                                style={{
                                  display: "inline-block",
                                  marginRight: "0.25rem",
                                  padding: "0.1rem 0.4rem",
                                  background: "var(--bg)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 4,
                                  color: "var(--muted)",
                                }}
                              >
                                {n}
                              </span>
                            ))}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startEditingTask(t);
                          }}
                          style={{
                            marginLeft: "0.5rem",
                            padding: "0.2rem 0.5rem",
                            fontSize: "0.85rem",
                            background: "transparent",
                            border: "1px solid var(--border)",
                            borderRadius: 4,
                            color: "var(--muted)",
                          }}
                        >
                          Editar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem 0" }}>
                  {planTaskDefinitions
                    .filter((t) => (t.parentTaskDefinitionId ?? null) === null)
                    .map((root) => {
                      const renderNode = (t: typeof root, level: number) => {
                        let tagNames: string[] = [];
                        try {
                          const dv = t.dimensionValues ? JSON.parse(t.dimensionValues) as Record<string, string> : {};
                          tagNames = dimensions.filter((d) => dv[d.id]).map((d) => d.name);
                        } catch {
                          /**/
                        }
                        const children = planTaskDefinitions.filter((c) => (c.parentTaskDefinitionId ?? null) === t.id);
                        const hasChildren = children.length > 0;
                        const isExpanded = expandedTaskIds.has(t.id);
                        return (
                          <li key={t.id} style={{ marginBottom: 4, marginLeft: level * 14 }}>
                            <div
                              style={{
                                padding: "0.5rem",
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                              }}
                            >
                              {hasChildren && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setExpandedTaskIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(t.id)) next.delete(t.id);
                                      else next.add(t.id);
                                      return next;
                                    });
                                  }}
                                  style={{
                                    marginRight: "0.5rem",
                                    padding: "0.1rem 0.35rem",
                                    borderRadius: 4,
                                    border: "1px solid var(--border)",
                                    background: "transparent",
                                    color: "var(--muted)",
                                    cursor: "pointer",
                                  }}
                                >
                                  {isExpanded ? "- " : "+ "}
                                </button>
                              )}
                              {t.name}{" "}
                              <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>({t.progressValueType})</span>
                              {tagNames.length > 0 && (
                                <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}>
                                  —{" "}
                                  {tagNames.map((n) => (
                                    <span
                                      key={n}
                                      style={{
                                        display: "inline-block",
                                        marginRight: "0.25rem",
                                        padding: "0.1rem 0.4rem",
                                        background: "var(--bg)",
                                        border: "1px solid var(--border)",
                                        borderRadius: 4,
                                        color: "var(--muted)",
                                      }}
                                    >
                                      {n}
                                    </span>
                                  ))}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  startEditingTask(t);
                                }}
                                style={{
                                  marginLeft: "0.5rem",
                                  padding: "0.2rem 0.5rem",
                                  fontSize: "0.85rem",
                                  background: "transparent",
                                  border: "1px solid var(--border)",
                                  borderRadius: 4,
                                  color: "var(--muted)",
                                }}
                              >
                                Editar
                              </button>
                            </div>
                            {hasChildren && isExpanded ? (
                              <ul style={{ listStyle: "none", padding: 0, marginTop: 6 }}>
                                {children.map((c) => renderNode(c, level + 1))}
                              </ul>
                            ) : null}
                          </li>
                        );
                      };
                      return renderNode(root, 0);
                    })}
                </ul>
              )
            )}
            {!showAddTask ? (
              <button
                type="button"
                onClick={() => {
                  setEditingTaskId(null);
                  setNewTaskName("");
                  setNewTaskType("percent");
                  setNewTaskUnit("");
                  setSelectedDimensionIds({});
                  setNewTaskParentTaskId("");
                  setShowAddTask(true);
                }}
                style={{
                  padding: "0.5rem 1rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text)",
                }}
              >
                + Agregar tarea
              </button>
            ) : (
              <div
                style={{
                  padding: "1rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  marginTop: "0.5rem",
                }}
              >
                <p style={{ color: "var(--muted)", marginBottom: "0.5rem", fontWeight: 500 }}>
                  {editingTaskId ? "Editar tarea" : "Nueva tarea"}
                </p>
                <input
                  placeholder="Nombre de la tarea"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text)",
                  }}
                />
                <div style={{ marginBottom: "0.5rem" }}>
                  <label style={{ marginRight: "0.5rem", color: "var(--muted)" }}>Tipo de avance</label>
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value as "percent" | "quantity" | "state")}
                    style={{
                      padding: "0.5rem",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text)",
                    }}
                  >
                    <option value="percent">Porcentaje (%)</option>
                    <option value="quantity">Cantidad (m², unidades…)</option>
                    <option value="state">Estado (pendiente / en curso / terminado)</option>
                  </select>
                </div>
                <div style={{ marginBottom: "0.5rem" }}>
                  <label style={{ marginRight: "0.5rem", color: "var(--muted)" }}>Tarea padre (opcional)</label>
                  <select
                    value={newTaskParentTaskId}
                    onChange={(e) => setNewTaskParentTaskId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text)",
                    }}
                    disabled={!currentPlan}
                  >
                    <option value="">Ninguna</option>
                    {(currentPlan?.taskDefinitions ?? []).map((t) => (
                      <option key={t.id} value={t.id} disabled={editingTaskId === t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                {newTaskType === "quantity" && (
                  <input
                    placeholder="Unidad (ej. m²)"
                    value={newTaskUnit}
                    onChange={(e) => setNewTaskUnit(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      marginBottom: "0.5rem",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text)",
                    }}
                  />
                )}
                {dimensions.length > 0 && (
                  <div style={{ marginBottom: "0.5rem" }}>
                    <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                      Seleccioná las dimensiones que aplican a esta tarea (para agrupar y filtrar)
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem" }}>
                      {dimensions.map((d) => (
                        <label
                          key={d.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            cursor: "pointer",
                            color: "var(--text)",
                            fontSize: "0.9rem",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedDimensionIds[d.id]}
                            onChange={(e) =>
                              setSelectedDimensionIds((prev) => ({ ...prev, [d.id]: e.target.checked }))
                            }
                            style={{ accentColor: "var(--accent)" }}
                          />
                          {d.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {(addTask.error || updateTask.error) && (
                  <p style={{ color: "#ef4444", marginTop: "0.5rem", marginBottom: 0 }}>
                    {(addTask.error || updateTask.error) instanceof Error
                      ? (addTask.error || updateTask.error)!.message
                      : "Error al guardar"}
                  </p>
                )}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (editingTaskId) {
                        updateTask.mutate([currentPlan.id, editingTaskId]);
                      } else {
                        addTask.mutate(currentPlan.id);
                      }
                    }}
                    disabled={!newTaskName.trim() || addTask.isPending || updateTask.isPending}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "var(--accent)",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                    }}
                  >
                    {updateTask.isPending || addTask.isPending
                      ? "Guardando…"
                      : editingTaskId
                        ? "Guardar cambios"
                        : "Guardar tarea"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelTaskForm}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text)",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div>
            <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>Sin plan creado.</p>
            {createPlan.error && (
              <p style={{ color: "#ef4444", marginBottom: "0.5rem" }}>
                {createPlan.error instanceof Error ? createPlan.error.message : "Error al crear el plan"}
              </p>
            )}
            <button
              type="button"
              onClick={() => createPlan.mutate()}
              disabled={createPlan.isPending}
              style={{
                padding: "0.5rem 1rem",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 6,
              }}
            >
              {createPlan.isPending ? "Creando…" : "Crear plan"}
            </button>
          </div>
        )}
        </section>
      )}

      {activeCategory === "planificacion" && activePlanningTab === "dimensiones" && (
        <>
          {/* Dimensiones (para clasificar tareas: proveedor, ambiente, etc.) */}
          <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Dimensiones</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
          Las dimensiones son etiquetas para agrupar y filtrar tareas. Definí las que necesites (ej. Proveedor, Tipo de ambiente) y luego, al crear cada tarea en &quot;Agregar tarea&quot;, seleccioná qué dimensiones aplican a esa tarea.
        </p>
        {dimensions.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0.75rem 0" }}>
            {dimensions.map((d) => (
              <li
                key={d.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.5rem 0.75rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  marginBottom: 4,
                }}
              >
                <span style={{ color: "var(--text)" }}>{d.name}</span>
                <code style={{ fontSize: "0.85rem", color: "var(--muted)", marginRight: "auto", marginLeft: "0.5rem" }}>{d.key}</code>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteDimension.mutate(d.id);
                  }}
                  disabled={deleteDimension.isPending}
                  style={{
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.85rem",
                    background: "transparent",
                    border: "1px solid #ef4444",
                    borderRadius: 4,
                    color: "#ef4444",
                  }}
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        )}
        {!showAddDim ? (
          <button
            type="button"
            onClick={() => setShowAddDim(true)}
            style={{
              padding: "0.5rem 1rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text)",
            }}
          >
            + Agregar dimensión
          </button>
        ) : (
          <div
            style={{
              padding: "1rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            <input
              placeholder="Nombre (ej. Proveedor)"
              value={newDimName}
              onChange={(e) => setNewDimName(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem",
                marginBottom: "0.5rem",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
              }}
            />
            <input
              placeholder="Clave (ej. proveedor, solo minúsculas y _)"
              value={newDimKey}
              onChange={(e) => setNewDimKey(e.target.value.replace(/\s/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              style={{
                width: "100%",
                padding: "0.5rem",
                marginBottom: "0.5rem",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
              }}
            />
            {createDimension.error && (
              <p style={{ color: "#ef4444", marginBottom: "0.5rem" }}>
                {createDimension.error instanceof Error ? createDimension.error.message : "Error al crear la dimensión"}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  createDimension.mutate();
                }}
                disabled={!newDimName.trim() || !newDimKey.trim() || createDimension.isPending}
                style={{
                  padding: "0.5rem 1rem",
                  background: "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                }}
              >
                {createDimension.isPending ? "Creando…" : "Crear"}
              </button>
              <button
                type="button"
                onClick={() => { setShowAddDim(false); setNewDimName(""); setNewDimKey(""); }}
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text)",
                  background: "transparent",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
          </section>
        </>
      )}

      {activeCategory === "planificacion" && activePlanningTab === "espacial" && (
        <>
          {/* Ubicaciones */}
          <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Ubicaciones</h2>
        {(levels.length === 0 || showAddLevel) ? (
          <div
            style={{
              padding: "1rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              marginBottom: "1rem",
            }}
          >
            <p style={{ color: "var(--muted)", marginBottom: "0.5rem" }}>
              {levels.length === 0
                ? "Primero definí al menos un nivel de ubicación (ej. Edificio, Piso, Unidad)."
                : "Agregar otro nivel de ubicación."}
            </p>
            <input
              placeholder="Nombre del nivel (ej. Piso)"
              value={newLevelName}
              onChange={(e) => setNewLevelName(e.target.value)}
              style={{
                width: "100%",
                maxWidth: 280,
                padding: "0.5rem",
                marginRight: "0.5rem",
                marginBottom: "0.5rem",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
              }}
            />
            <input
              type="number"
              min={0}
              placeholder="Orden"
              value={newLevelOrder}
              onChange={(e) => setNewLevelOrder(Number(e.target.value))}
              style={{
                width: 80,
                padding: "0.5rem",
                marginLeft: "0.5rem",
                marginBottom: "0.5rem",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
              }}
            />
            <br />
            <button
              type="button"
              onClick={() => createLevel.mutate()}
              disabled={!newLevelName.trim() || createLevel.isPending}
              style={{
                padding: "0.5rem 1rem",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 6,
              }}
            >
              {createLevel.isPending ? "Creando…" : "Crear nivel"}
            </button>
            {levels.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddLevel(false)}
                style={{
                  marginLeft: "0.5rem",
                  padding: "0.5rem 1rem",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text)",
                  background: "transparent",
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        ) : null}
        {levels.length > 0 && !showAddLevel && (
          <button
            type="button"
            onClick={() => setShowAddLevel(true)}
            style={{
              padding: "0.5rem 1rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text)",
              marginBottom: "1rem",
            }}
          >
            + Agregar nivel de ubicación
          </button>
        )}
        {levels.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Niveles definidos</p>
            {deleteLevel.error && (
              <p style={{ color: "#ef4444", marginBottom: "0.5rem" }}>
                {deleteLevel.error instanceof Error ? deleteLevel.error.message : "Error al borrar"}
              </p>
            )}
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {levels.map((l) => (
                <li
                  key={l.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.5rem 0.75rem",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: "var(--text)" }}>{l.name}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Orden: {l.order}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteLevel.mutate(l.id);
                    }}
                    disabled={deleteLevel.isPending}
                    style={{
                      padding: "0.25rem 0.5rem",
                      fontSize: "0.85rem",
                      background: "transparent",
                      border: "1px solid #ef4444",
                      borderRadius: 4,
                      color: "#ef4444",
                    }}
                  >
                    {deleteLevel.isPending ? "…" : "Borrar"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {locations.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem 0" }}>
            {locations.map((loc) => (
              <li
                key={loc.id}
                style={{
                  padding: "0.5rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  marginBottom: 4,
                }}
              >
                {editingLocationId === loc.id ? (
                  <div style={{ padding: "0.25rem 0" }}>
                    <input
                      placeholder="Nombre"
                      value={editLocName}
                      onChange={(e) => setEditLocName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        marginBottom: "0.5rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--text)",
                      }}
                    />
                    {currentPlan?.taskDefinitions && currentPlan.taskDefinitions.length > 0 && (
                      <div style={{ marginBottom: "0.5rem" }}>
                        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.25rem" }}>Tareas asociadas</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                          {currentPlan.taskDefinitions.map((t) => (
                            <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={editLocTaskIds.includes(t.id)}
                                onChange={(e) =>
                                  setEditLocTaskIds((prev) =>
                                    e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                                  )
                                }
                              />
                              <span style={{ fontSize: "0.9rem" }}>{t.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => updateLocation.mutate()}
                        disabled={!editLocName.trim() || updateLocation.isPending}
                        style={{
                          padding: "0.35rem 0.75rem",
                          background: "var(--accent)",
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                        }}
                      >
                        {updateLocation.isPending ? "Guardando…" : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLocationId(null);
                          setEditLocName("");
                          setEditLocTaskIds([]);
                        }}
                        style={{
                          padding: "0.35rem 0.75rem",
                          background: "transparent",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          color: "var(--text)",
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : replicatingFromLocationId === loc.id ? (
                  <div style={{ padding: "0.25rem 0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={replicateFromCount}
                      onChange={(e) => setReplicateFromCount(Number(e.target.value) || 1)}
                      style={{
                        width: "4rem",
                        padding: "0.35rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--text)",
                      }}
                    />
                    <span style={{ fontSize: "0.9rem" }}>copias</span>
                    <input
                      placeholder="Prefijo nombre (opcional)"
                      value={replicateFromPrefix}
                      onChange={(e) => setReplicateFromPrefix(e.target.value)}
                      style={{
                        width: "10rem",
                        padding: "0.35rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--text)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => replicateFromLocation.mutate()}
                      disabled={replicateFromCount < 1 || replicateFromLocation.isPending}
                      style={{
                        padding: "0.35rem 0.75rem",
                        background: "var(--accent)",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                      }}
                    >
                      {replicateFromLocation.isPending ? "Creando…" : "Crear copias"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplicatingFromLocationId(null);
                        setReplicateFromPrefix("");
                      }}
                      style={{
                        padding: "0.35rem 0.75rem",
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        color: "var(--text)",
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <>
                    {loc.name} <code style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{loc.path}</code>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLocationId(loc.id);
                        setEditLocName(loc.name);
                        setEditLocTaskIds(loc.taskDefinitionIds ?? []);
                      }}
                      style={{
                        marginLeft: "0.5rem",
                        padding: "0.2rem 0.5rem",
                        fontSize: "0.85rem",
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        color: "var(--text)",
                        cursor: "pointer",
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplicatingFromLocationId(loc.id)}
                      style={{
                        marginLeft: "0.25rem",
                        padding: "0.2rem 0.5rem",
                        fontSize: "0.85rem",
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        color: "var(--text)",
                        cursor: "pointer",
                      }}
                    >
                      Replicar N veces
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined" && window.confirm("¿Borrar esta ubicación y las que cuelgan de ella?")) {
                          deleteLocation.mutate(loc.id);
                        }
                      }}
                      disabled={deleteLocation.isPending}
                      style={{
                        marginLeft: "0.25rem",
                        padding: "0.2rem 0.5rem",
                        fontSize: "0.85rem",
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        color: "#dc2626",
                        cursor: "pointer",
                      }}
                    >
                      Borrar
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {locations.length === 0 && levels.length > 0 && (
          <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>Sin ubicaciones.</p>
        )}
        {levels.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
            {!showAddLoc ? (
              <button
                type="button"
                onClick={() => setShowAddLoc(true)}
                style={{
                  padding: "0.5rem 1rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text)",
                }}
              >
                + Agregar ubicación
              </button>
            ) : (
              <div
                style={{
                  width: "100%",
                  padding: "1rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <input
                  placeholder="Nombre (ej. Planta Baja)"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text)",
                  }}
                />
                <select
                  value={newLocLevelId}
                  onChange={(e) => setNewLocLevelId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text)",
                  }}
                >
                  <option value="">Seleccionar nivel</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                {locations.length > 0 && (
                  <select
                    value={newLocParentId}
                    onChange={(e) => setNewLocParentId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      marginBottom: "0.5rem",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text)",
                    }}
                  >
                    <option value="">Sin padre (raíz)</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                )}
                {currentPlan?.taskDefinitions && currentPlan.taskDefinitions.length > 0 && (
                  <div style={{ marginBottom: "0.5rem" }}>
                    <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.25rem" }}>Tareas asociadas a esta ubicación</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {currentPlan.taskDefinitions.map((t) => (
                        <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={newLocTaskIds.includes(t.id)}
                            onChange={(e) =>
                              setNewLocTaskIds((prev) =>
                                e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                              )
                            }
                          />
                          <span style={{ fontSize: "0.9rem" }}>{t.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => createLocation.mutate()}
                    disabled={!newLocName.trim() || !newLocLevelId || createLocation.isPending}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "var(--accent)",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                    }}
                  >
                    {createLocation.isPending ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddLoc(false)}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text)",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {!showReplicate ? (
              <button
                type="button"
                onClick={() => setShowReplicate(true)}
                style={{
                  padding: "0.5rem 1rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text)",
                }}
              >
                + Replicar ubicaciones (N iguales)
              </button>
            ) : (
              <div
                style={{
                  width: "100%",
                  padding: "1rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  marginTop: "0.5rem",
                }}
              >
                <input
                  placeholder="Prefijo (ej. Unidad)"
                  value={replicatePrefix}
                  onChange={(e) => setReplicatePrefix(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text)",
                  }}
                />
                <input
                  type="number"
                  min={1}
                  max={500}
                  placeholder="Cantidad"
                  value={replicateCount}
                  onChange={(e) => setReplicateCount(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text)",
                  }}
                />
                <select
                  value={replicateLevelId}
                  onChange={(e) => setReplicateLevelId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text)",
                  }}
                >
                  <option value="">Nivel</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <select
                  value={replicateParentId}
                  onChange={(e) => setReplicateParentId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginBottom: "0.5rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text)",
                  }}
                >
                  <option value="">Sin padre</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                {currentPlan?.taskDefinitions && currentPlan.taskDefinitions.length > 0 && (
                  <div style={{ marginBottom: "0.5rem" }}>
                    <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.25rem" }}>Tareas asociadas (se copian a todas las réplicas)</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {currentPlan.taskDefinitions.map((t) => (
                        <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={replicateTaskIds.includes(t.id)}
                            onChange={(e) =>
                              setReplicateTaskIds((prev) =>
                                e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                              )
                            }
                          />
                          <span style={{ fontSize: "0.9rem" }}>{t.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => replicateLocations.mutate()}
                    disabled={!replicateLevelId || replicateCount < 1 || replicateLocations.isPending}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "var(--accent)",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                    }}
                  >
                    {replicateLocations.isPending ? "Creando…" : `Crear ${replicateCount} ubicaciones`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReplicate(false)}
                    style={{
                      padding: "0.5rem 1rem",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text)",
                      background: "transparent",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
          </section>
        </>
      )}

      {activeCategory === "consulta" && projections.length > 0 && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Proyección por velocidad</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            A este ritmo de avance, estimación de días para completar (donde aplique).
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {projections.slice(0, 10).map((p, i) => (
              <li
                key={i}
                style={{
                  padding: "0.5rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  marginBottom: 4,
                }}
              >
                Tarea {p.taskDefinitionId.slice(0, 8)}… / Ubicación {p.locationId.slice(0, 8)}… — Actual: {p.currentValue} · Días estimados: {p.daysToComplete != null ? Math.round(p.daysToComplete) : "—"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Asignaciones (tareas ↔ ubicaciones) */}
      {activeCategory === "planificacion" && activePlanningTab === "asignaciones" && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Asignaciones</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
            Asociá tareas a ubicaciones. Esto define qué se puede registrar como avance para cada combinación.
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "-0.35rem", marginBottom: "0.75rem" }}>
            Nota: el metrado total planificado por tarea/ubicación todavía no está modelado en el backend; por ahora se registra el valor de avance.
          </p>

          {!currentPlan ? (
            <p style={{ color: "var(--muted)" }}>Primero creá un plan en la pestaña Tareas.</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ flex: "0 0 300px", minWidth: 260 }}>
                  <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Ubicación</p>
                  <select
                    value={assignmentLocationId}
                    onChange={(e) => {
                      const locId = e.target.value;
                      setAssignmentLocationId(locId);
                      const loc = locations.find((l) => l.id === locId);
                      setAssignmentTaskIds(loc?.taskDefinitionIds ?? []);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      marginBottom: "0.75rem",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text)",
                    }}
                  >
                    <option value="">Seleccionar ubicación</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: "1 1 320px", minWidth: 260 }}>
                  <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Tareas</p>
                  {!assignmentLocationId ? (
                    <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>Elegí una ubicación para ver sus tareas.</p>
                  ) : planTaskDefinitions.length === 0 ? (
                    <p style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>No hay tareas en el plan.</p>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem" }}>
                        {planTaskDefinitions.map((t) => (
                          <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={assignmentTaskIds.includes(t.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setAssignmentTaskIds((prev) =>
                                  checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                                );
                              }}
                            />
                            <span style={{ fontSize: "0.9rem", color: "var(--text)" }}>{t.name}</span>
                          </label>
                        ))}
                      </div>
                      {updateLocationTaskDefinitions.error && (
                        <p style={{ color: "#ef4444", marginTop: "0.75rem" }}>
                          {updateLocationTaskDefinitions.error instanceof Error
                            ? updateLocationTaskDefinitions.error.message
                            : "Error al guardar asignaciones"}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() =>
                    updateLocationTaskDefinitions.mutate({
                      locationId: assignmentLocationId,
                      taskDefinitionIds: assignmentTaskIds,
                    })
                  }
                  disabled={
                    !assignmentLocationId ||
                    updateLocationTaskDefinitions.isPending ||
                    planTaskDefinitions.length === 0
                  }
                  style={{
                    padding: "0.5rem 1rem",
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                  }}
                >
                  {updateLocationTaskDefinitions.isPending ? "Guardando…" : "Guardar asignaciones"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAssignmentLocationId("");
                    setAssignmentTaskIds([]);
                  }}
                  disabled={updateLocationTaskDefinitions.isPending}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text)",
                    background: "transparent",
                  }}
                >
                  Limpiar
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Validación del plan */}
      {activeCategory === "planificacion" && activePlanningTab === "validacion" && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Validación</h2>
          {!currentPlan ? (
            <p style={{ color: "var(--muted)" }}>Creá un plan para que aparezcan validaciones.</p>
          ) : (
            <>
              <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
                Checklist rápido para detectar inconsistencias antes de registrar avances.
              </p>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "-0.35rem", marginBottom: "0.75rem" }}>
                Nota: todavía no se calcula metrado total por tarea/ubicación; la validación se centra en la asociación (qué se puede cargar).
              </p>

              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {tasksWithoutLocations.length > 0 && (
                  <li
                    style={{
                      padding: "0.75rem",
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.35)",
                      borderRadius: 8,
                      marginBottom: "0.5rem",
                    }}
                  >
                    <strong style={{ color: "#ef4444" }}>Tareas sin ubicaciones:</strong>{" "}
                    {tasksWithoutLocations.map((t) => t.name).join(", ")}
                  </li>
                )}
                {locationsWithoutTasks.length > 0 && (
                  <li
                    style={{
                      padding: "0.75rem",
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.35)",
                      borderRadius: 8,
                      marginBottom: "0.5rem",
                    }}
                  >
                    <strong style={{ color: "#ef4444" }}>Ubicaciones sin tareas:</strong>{" "}
                    {locationsWithoutTasks
                      .slice(0, 6)
                      .map((l) => l.name)
                      .join(", ")}
                    {locationsWithoutTasks.length > 6 ? "…" : ""}
                  </li>
                )}
                {tasksWithoutLocations.length === 0 && locationsWithoutTasks.length === 0 && (
                  <li
                    style={{
                      padding: "0.75rem",
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.35)",
                      borderRadius: 8,
                    }}
                  >
                    <strong style={{ color: "#22c55e" }}>OK:</strong> el plan está listo para registrar avances.
                  </li>
                )}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Consulta de estado (detalle consolidado) */}
      {activeCategory === "consulta" && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Estado actual</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
            La carga se registra por tarea y ubicación en el plan. Acá se muestra el estado consolidado.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "1rem" }}>
            <div style={{ flex: "0 0 260px", minWidth: 220 }}>
              <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Filtrar por dimensión</p>
              <select
                value={dimensionFilterId}
                onChange={(e) => setDimensionFilterId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text)",
                }}
              >
                <option value="">Todas</option>
                {dimensions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            {dimensionFilterId ? (
              <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                Mostrando {filteredItems.length} avances relacionados.
              </p>
            ) : null}
          </div>

          {filteredItems.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "0.5rem" }}>Tarea</th>
                    <th style={{ textAlign: "left", padding: "0.5rem" }}>Ubicación</th>
                    <th style={{ textAlign: "left", padding: "0.5rem" }}>Dimensiones</th>
                    <th style={{ textAlign: "right", padding: "0.5rem" }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.5rem" }}>{item.taskDefinitionId.slice(0, 8)}…</td>
                      <td style={{ padding: "0.5rem" }}>{item.locationId.slice(0, 8)}…</td>
                      <td style={{ padding: "0.5rem" }}>
                        {(taskDimensionNamesByTaskId[item.taskDefinitionId] ?? []).join(", ") || "—"}
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "right" }}>{String(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "var(--muted)" }}>Aún no hay avances cargados.</p>
          )}
        </section>
      )}

      {activeCategory === "registro" && (
        <section>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Avance registrado</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          La asociación tarea–ubicación se define en el plan (Ubicaciones). Acá solo se registra valor (%, cantidad o estado) para una tarea ya asociada a la ubicación elegida.
        </p>
        {!showRecordProgress ? (
          <button
            type="button"
            onClick={() => setShowRecordProgress(true)}
            style={{
              padding: "0.5rem 1rem",
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: 6,
              marginBottom: "1rem",
            }}
          >
            + Registrar avance
          </button>
        ) : (
          <div
            style={{
              padding: "1rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              marginBottom: "1rem",
            }}
          >
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Ubicación</p>
            <select
              value={progressLocationId}
              onChange={(e) => {
                setProgressLocationId(e.target.value);
                setProgressTaskId("");
                setProgressValue("");
              }}
              style={{
                width: "100%",
                padding: "0.5rem",
                marginBottom: "0.75rem",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
              }}
            >
              <option value="">Seleccionar ubicación</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Tarea (solo las asociadas a esta ubicación)</p>
            {!progressLocationId ? (
              <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.75rem" }}>Seleccioná primero una ubicación.</p>
            ) : tasksForProgressLocation.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.75rem" }}>Esta ubicación no tiene tareas asociadas. Asociá tareas en la sección Ubicaciones (crear o replicar).</p>
            ) : (
              <select
                value={progressTaskId}
                onChange={(e) => {
                  setProgressTaskId(e.target.value);
                  setProgressValue("");
                }}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  marginBottom: "0.75rem",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text)",
                }}
              >
                <option value="">Seleccionar tarea</option>
                {tasksForProgressLocation.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.progressValueType})
                  </option>
                ))}
              </select>
            )}
            {selectedTaskForProgress?.progressValueType === "state" ? (
              <>
                <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Estado</p>
                <select
                  value={progressValue}
                  onChange={(e) => setProgressValue(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginBottom: "0.75rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text)",
                  }}
                >
                  <option value="">Seleccionar estado</option>
                  {selectedTaskStateOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                  {selectedTaskForProgress?.progressValueType === "quantity"
                    ? `Cantidad (${selectedTaskForProgress?.quantityUnit ?? "unidad"})`
                    : "Porcentaje (%)"}
                </p>
                <input
                  type="number"
                  step="any"
                  placeholder={
                    selectedTaskForProgress?.progressValueType === "quantity" ? "Ej: 25.5" : "Ej: 100"
                  }
                  value={progressValue}
                  onChange={(e) => setProgressValue(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    marginBottom: "0.75rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text)",
                  }}
                />
              </>
            )}
            {recordProgress.error && (
              <p style={{ color: "#ef4444", marginBottom: "0.5rem" }}>
                {recordProgress.error instanceof Error ? recordProgress.error.message : "Error al registrar"}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => recordProgress.mutate()}
                disabled={!progressTaskId || !progressLocationId || !progressValue.trim() || recordProgress.isPending}
                style={{
                  padding: "0.5rem 1rem",
                  background: "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                }}
              >
                {recordProgress.isPending ? "Guardando…" : "Guardar avance"}
              </button>
              <button
                type="button"
                onClick={() => setShowRecordProgress(false)}
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  color: "var(--text)",
                  background: "transparent",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "1rem" }}>
          Avances cargados: {items.length}. Para ver el detalle, usá la pestaña `Consulta de estado`.
        </p>
        </section>
      )}
    </main>
  );
}
