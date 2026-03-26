"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { token, tenantId } = await login(email, password);
      if (typeof window !== "undefined") {
        localStorage.setItem("token", token);
        if (tenantId) localStorage.setItem("tenantId", tenantId);
      }
      router.push("/projects");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 400, margin: "4rem auto" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Iniciar sesión</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label htmlFor="email" style={{ display: "block", marginBottom: 4, color: "var(--muted)" }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "0.5rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text)",
            }}
          />
        </div>
        <div>
          <label htmlFor="password" style={{ display: "block", marginBottom: 4, color: "var(--muted)" }}>
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "0.5rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text)",
            }}
          />
        </div>
        {error && <p style={{ color: "#ef4444", margin: 0 }}>{error}</p>}
        <button
          type="submit"
          style={{
            padding: "0.75rem",
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: 6,
          }}
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
