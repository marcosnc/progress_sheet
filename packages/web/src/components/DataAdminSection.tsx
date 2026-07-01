"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ImportPreview, ProposedChange } from "@progress-sheet/shared";
import { dataTransferApi } from "@/lib/api";

const ENTITY_LABELS: Record<string, string> = {
  locationLevel: "Niveles",
  dimension: "Dimensiones",
  task: "Tareas",
  location: "Ubicaciones",
  assignment: "Asignaciones",
  dependency: "Dependencias",
  progressEvent: "Avance",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Alta",
  update: "Modificación",
  delete: "Baja",
};

interface DataAdminSectionProps {
  projectId: string;
  projectName: string;
}

export function DataAdminSection({ projectId, projectName }: DataAdminSectionProps) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const groupedChanges = useMemo(() => {
    if (!preview?.changes.length) return [];
    const groups = new Map<string, ProposedChange[]>();
    for (const change of preview.changes) {
      const key = change.entity;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(change);
    }
    return Array.from(groups.entries());
  }, [preview]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await dataTransferApi.export(projectId);
      const date = new Date().toISOString().slice(0, 10);
      const safeName = projectName.replace(/[^\w\-]+/g, "_").slice(0, 50);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proyecto-${safeName}-${date}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  }, [projectId, projectName]);

  const previewMutation = useMutation({
    mutationFn: (file: File) => dataTransferApi.previewImport(projectId, file),
    onSuccess: (result) => {
      setPreview(result);
      setImportError(null);
      if (result.errors.length > 0) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(result.changes.map((c) => c.id)));
      }
    },
    onError: (e) => {
      setImportError(e instanceof Error ? e.message : "Error al importar");
      setPreview(null);
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!preview?.sessionId) throw new Error("No hay sesión de importación");
      return dataTransferApi.applyImport(projectId, preview.sessionId, Array.from(selectedIds));
    },
    onSuccess: () => {
      setPreview(null);
      setSelectedIds(new Set());
      setImportError(null);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["plans", projectId] });
      queryClient.invalidateQueries({ queryKey: ["locations", projectId] });
      queryClient.invalidateQueries({ queryKey: ["location-levels"] });
      queryClient.invalidateQueries({ queryKey: ["dimensions"] });
      queryClient.invalidateQueries({ queryKey: ["progress", projectId] });
    },
    onError: (e) => {
      setImportError(e instanceof Error ? e.message : "Error al aplicar cambios");
    },
  });

  function toggleChange(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!preview) return;
    setSelectedIds(checked ? new Set(preview.changes.map((c) => c.id)) : new Set());
  }

  return (
    <section style={{ marginTop: "1rem" }}>
      <h2 style={{ marginBottom: "0.5rem" }}>Administración de datos</h2>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem", maxWidth: 640 }}>
        Exportá todos los datos del proyecto a una planilla Excel (.xlsx), modificá la planilla y
        reimportala para revisar y aplicar los cambios. Compatible con Google Sheets al subir el
        archivo manualmente.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <button
          type="button"
          className="ps-btnPrimary"
          disabled={exporting}
          onClick={() => void handleExport()}
        >
          {exporting ? "Exportando…" : "Exportar .xlsx"}
        </button>
        <label className="ps-btn" style={{ cursor: "pointer", display: "inline-block" }}>
          {previewMutation.isPending ? "Analizando…" : "Importar .xlsx"}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: "none" }}
            disabled={previewMutation.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) previewMutation.mutate(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {importError && (
        <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{importError}</p>
      )}

      {preview && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "1rem",
            background: "var(--surface)",
          }}
        >
          {preview.errors.length > 0 ? (
            <div>
              <h3 style={{ color: "#ef4444", marginTop: 0 }}>Errores en la planilla</h3>
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {preview.errors.map((err) => (
                  <li key={err} style={{ color: "#ef4444", marginBottom: 4 }}>
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                <p style={{ margin: 0, color: "var(--muted)" }}>
                  {preview.summary.total} cambio(s): {preview.summary.creates} alta(s),{" "}
                  {preview.summary.updates} modificación(es), {preview.summary.deletes} baja(s)
                </p>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.9rem" }}>
                  <input
                    type="checkbox"
                    checked={
                      preview.changes.length > 0 && selectedIds.size === preview.changes.length
                    }
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  Seleccionar todos
                </label>
              </div>

              {preview.changes.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>La planilla coincide con los datos actuales.</p>
              ) : (
                groupedChanges.map(([entity, changes]) => (
                  <div key={entity} style={{ marginBottom: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.5rem" }}>{ENTITY_LABELS[entity] ?? entity}</h4>
                    <ul className="ps-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {changes.map((change) => (
                        <li
                          key={change.id}
                          className="ps-row"
                          style={{
                            borderColor:
                              change.action === "delete" ? "rgba(239,68,68,0.4)" : undefined,
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 8,
                              flex: 1,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(change.id)}
                              onChange={() => toggleChange(change.id)}
                              style={{ marginTop: 4 }}
                            />
                            <span>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  marginRight: 6,
                                  background:
                                    change.action === "delete"
                                      ? "rgba(239,68,68,0.2)"
                                      : change.action === "create"
                                        ? "rgba(34,197,94,0.2)"
                                        : "rgba(59,130,246,0.2)",
                                }}
                              >
                                {ACTION_LABELS[change.action]}
                              </span>
                              {change.label}
                              {change.warnings?.map((w) => (
                                <span
                                  key={w}
                                  style={{ display: "block", color: "#f59e0b", fontSize: "0.85rem" }}
                                >
                                  ⚠ {w}
                                </span>
                              ))}
                              {change.fieldChanges && change.fieldChanges.length > 0 && (
                                <span
                                  style={{
                                    display: "block",
                                    color: "var(--muted)",
                                    fontSize: "0.85rem",
                                    marginTop: 4,
                                  }}
                                >
                                  {change.fieldChanges.map((fc) => (
                                    <span key={fc.field} style={{ display: "block" }}>
                                      {fc.field}: {String(fc.before ?? "—")} → {String(fc.after ?? "—")}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}

              {preview.changes.length > 0 && (
                <button
                  type="button"
                  className="ps-btnPrimary"
                  disabled={applyMutation.isPending || selectedIds.size === 0}
                  onClick={() => applyMutation.mutate()}
                >
                  {applyMutation.isPending
                    ? "Aplicando…"
                    : `Aplicar ${selectedIds.size} cambio(s) seleccionado(s)`}
                </button>
              )}

              {applyMutation.data && (
                <p style={{ color: "var(--muted)", marginTop: "0.75rem", marginBottom: 0 }}>
                  Aplicados: {applyMutation.data.applied}. Omitidos: {applyMutation.data.skipped}.
                  {applyMutation.data.errors.length > 0 && (
                    <span style={{ display: "block", color: "#ef4444" }}>
                      {applyMutation.data.errors.join("; ")}
                    </span>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
