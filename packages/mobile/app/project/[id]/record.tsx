import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
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

export default function RecordProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tasks, setTasks] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [taskId, setTaskId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api(`/projects/${id}/plans`).then((d: { plans?: { taskDefinitions?: { id: string; name: string }[] }[] }) => {
        const plan = (d as { plans?: { taskDefinitions?: { id: string; name: string }[] }[] }).plans?.[0];
        return plan?.taskDefinitions ?? [];
      }),
      api(`/projects/${id}/locations`).then((d: { locations?: { id: string; name: string }[] }) => (d as { locations?: { id: string; name: string }[] }).locations ?? []),
    ])
      .then(([t, loc]) => {
        setTasks(t);
        setLocations(loc);
        if (t[0]) setTaskId(t[0].id);
        if (loc[0]) setLocationId(loc[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function submit() {
    if (!id || !taskId || !locationId || value === "") return;
    setError("");
    setSending(true);
    try {
      await api(`/projects/${id}/progress`, {
        method: "POST",
        body: JSON.stringify({
          taskDefinitionId: taskId,
          locationId,
          value: Number(value) || value,
        }),
      });
      setDone(true);
      setTimeout(() => router.back(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f0f12" }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0f0f12" }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 20, color: "#e4e4e7", marginBottom: 16 }}>Registrar avance</Text>
      {error ? <Text style={{ color: "#ef4444", marginBottom: 12 }}>{error}</Text> : null}
      {done ? <Text style={{ color: "#22c55e", marginBottom: 12 }}>Avance registrado.</Text> : null}
      <Text style={{ color: "#71717a", marginBottom: 4 }}>Tarea</Text>
      <View style={{ marginBottom: 12 }}>
        {tasks.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTaskId(t.id)}
            style={{
              padding: 12,
              backgroundColor: taskId === t.id ? "#1e3a5f" : "#18181c",
              borderRadius: 8,
              marginBottom: 4,
              borderWidth: 1,
              borderColor: "#2a2a30",
            }}
          >
            <Text style={{ color: "#e4e4e7" }}>{t.name}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: "#71717a", marginBottom: 4 }}>Ubicación</Text>
      <View style={{ marginBottom: 12 }}>
        {locations.map((loc) => (
          <Pressable
            key={loc.id}
            onPress={() => setLocationId(loc.id)}
            style={{
              padding: 12,
              backgroundColor: locationId === loc.id ? "#1e3a5f" : "#18181c",
              borderRadius: 8,
              marginBottom: 4,
              borderWidth: 1,
              borderColor: "#2a2a30",
            }}
          >
            <Text style={{ color: "#e4e4e7" }}>{loc.name}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: "#71717a", marginBottom: 4 }}>Valor (% o cantidad)</Text>
      <TextInput
        style={{
          backgroundColor: "#18181c",
          borderWidth: 1,
          borderColor: "#2a2a30",
          borderRadius: 8,
          padding: 14,
          color: "#e4e4e7",
          marginBottom: 20,
        }}
        placeholder="Ej: 100 o 25.5"
        placeholderTextColor="#71717a"
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
      />
      <Pressable
        onPress={submit}
        disabled={sending || value === ""}
        style={{
          backgroundColor: sending ? "#1e3a5f" : "#3b82f6",
          padding: 14,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>{sending ? "Guardando…" : "Guardar avance"}</Text>
      </Pressable>
    </ScrollView>
  );
}
