"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { projectsApi } from "@/lib/api";
import { useState } from "react";

export default function ProjectsPage() {
  const [name, setName] = useState("");
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
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {projects.map((p) => (
          <li
            key={p.id}
            style={{
              padding: "1rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              marginBottom: "0.5rem",
            }}
          >
            <Link href={`/projects/${p.id}`} style={{ color: "inherit", fontWeight: 500 }}>
              {p.name}
            </Link>
          </li>
        ))}
      </ul>
      {projects.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No hay proyectos. Creá uno arriba.</p>
      )}
    </main>
  );
}
