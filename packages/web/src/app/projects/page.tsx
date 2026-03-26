"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { projectsApi } from "@/lib/api";
import { useState } from "react";
import { ListRow } from "@/components/ListRow";

export default function ProjectsPage() {
  const [name, setName] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
  });
  const create = useMutation({
    mutationFn: (n: string) => projectsApi.create(n),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setName("");
    },
  });

  const update = useMutation({
    mutationFn: (body: { id: string; name: string }) => projectsApi.update(body.id, body.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditingProjectId(null);
      setEditProjectName("");
    },
  });

  if (isLoading) return <p style={{ padding: "2rem" }}>Cargando...</p>;
  if (error) return <p style={{ padding: "2rem", color: "#ef4444" }}>Error: {String(error)}</p>;

  const projects = data?.projects ?? [];

  return (
    <main style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Proyectos</h1>
        <Link href="/" style={{ color: "var(--muted)" }}>Inicio</Link>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate(name.trim());
        }}
        style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del proyecto"
          style={{
            flex: 1,
            padding: "0.5rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text)",
          }}
        />
        <button
          type="submit"
          disabled={create.isPending || !name.trim()}
          style={{
            padding: "0.5rem 1rem",
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: 6,
          }}
        >
          Crear
        </button>
      </form>
      <ul className="ps-list">
        {projects.map((p) => (
          <li key={p.id}>
            {editingProjectId === p.id ? (
              <div className="ps-row">
                <div className="ps-rowMain">
                  <input
                    value={editProjectName}
                    onChange={(e) => setEditProjectName(e.target.value)}
                    placeholder="Nombre del proyecto"
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text)",
                    }}
                  />
                </div>
                <div className="ps-rowActions">
                  <button
                    type="button"
                    onClick={() => update.mutate({ id: p.id, name: editProjectName.trim() })}
                    disabled={!editProjectName.trim() || update.isPending}
                    className="ps-btn ps-btnPrimary"
                  >
                    {update.isPending ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProjectId(null);
                      setEditProjectName("");
                    }}
                    disabled={update.isPending}
                    className="ps-btn"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <ListRow
                left={
                  <Link href={`/projects/${p.id}`} style={{ color: "inherit", fontWeight: 500 }}>
                    {p.name}
                  </Link>
                }
                actionsRight={
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingProjectId(p.id);
                        setEditProjectName(p.name);
                      }}
                      className="ps-btn"
                    >
                      Editar
                    </button>
                  </>
                }
              />
            )}
          </li>
        ))}
      </ul>
      {projects.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No hay proyectos. Creá uno arriba.</p>
      )}
    </main>
  );
}
