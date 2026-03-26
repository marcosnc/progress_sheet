import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>Progress Sheet</h1>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
        Seguimiento de avance de obras y proyectos de construcción.
      </p>
      <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link
          href="/login"
          style={{
            padding: "0.5rem 1rem",
            background: "var(--surface)",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
        >
          Iniciar sesión
        </Link>
        <Link
          href="/projects"
          style={{
            padding: "0.5rem 1rem",
            background: "var(--accent)",
            color: "white",
            borderRadius: 6,
          }}
        >
          Proyectos
        </Link>
      </nav>
    </main>
  );
}
