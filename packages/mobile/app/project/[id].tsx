import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

const API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api";

async function api(path: string, options: RequestInit = {}) {
  const token = await SecureStore.getItemAsync("token");
  if (!token) throw new Error("No token");
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) throw new Error("Request failed");
  if (res.status === 204) return;
  return res.json();
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<{ name: string } | null>(null);
  const [progressItems, setProgressItems] = useState<{ taskDefinitionId: string; locationId: string; value: number | string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api(`/projects/${id}`),
      api(`/projects/${id}/progress/state`),
    ])
      .then(([proj, state]) => {
        setProject(proj as { name: string });
        setProgressItems((state as { items?: typeof progressItems })?.items ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !project) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f0f12" }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, padding: 24, backgroundColor: "#0f0f12" }}>
        <Text style={{ color: "#ef4444" }}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0f0f12" }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, color: "#e4e4e7", marginBottom: 8 }}>{project.name}</Text>
      <View style={{ marginBottom: 16 }}>
        <Pressable
          onPress={() => router.push({ pathname: "/project/[id]/record", params: { id: id! } })}
          style={{
            backgroundColor: "#3b82f6",
            padding: 12,
            borderRadius: 8,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>Registro de avance</Text>
        </Pressable>

        <View
          style={{
            padding: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#2a2a30",
            backgroundColor: "#18181c",
            marginBottom: 8,
          }}
        >
          <Text style={{ color: "#e4e4e7", fontWeight: "600", textAlign: "center" }}>Consulta de estado</Text>
        </View>

        <Text style={{ color: "#71717a" }}>Planificación: disponible en la web (por ahora).</Text>
      </View>

      <Text style={{ color: "#71717a", marginBottom: 16 }}>Avances registrados: {progressItems.length}</Text>
      {progressItems.length === 0 ? (
        <Text style={{ color: "#71717a" }}>Aún no hay avances. Registrá desde “Registro de avance”.</Text>
      ) : (
        progressItems.slice(0, 20).map((item, i) => (
          <View
            key={i}
            style={{
              padding: 12,
              backgroundColor: "#18181c",
              borderRadius: 8,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: "#2a2a30",
            }}
          >
            <Text style={{ color: "#71717a", fontSize: 12 }}>Tarea: {item.taskDefinitionId.slice(0, 8)}…</Text>
            <Text style={{ color: "#71717a", fontSize: 12 }}>Ubicación: {item.locationId.slice(0, 8)}…</Text>
            <Text style={{ color: "#e4e4e7", marginTop: 4 }}>Valor: {String(item.value)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
