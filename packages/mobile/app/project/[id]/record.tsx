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
  const [tasks, setTasks] = useState<{
    id: string;
    name: string;
    progressValueType: string;
    quantityUnit?: string | null;
    stateOptions?: string | null;
  }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string; taskDefinitionIds: string[] }[]>([]);

  // Paso 1: Ubicación -> Paso 2: Tarea asociada -> Paso 3: Valor
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
      api(`/projects/${id}/plans`).then((d: {
        plans?: {
          taskDefinitions?: {
            id: string;
            name: string;
            progressValueType: string;
            quantityUnit?: string | null;
            stateOptions?: string | null;
          }[];
        }[];
      }) => {
        const plan = (d as any)?.plans?.[0];
        return plan?.taskDefinitions ?? [];
      }),
      api(`/projects/${id}/locations`).then((d: { locations?: { id: string; name: string; taskDefinitionIds: string[] }[] }) =>
        (d as any)?.locations?.map((l: any) => ({
          id: l.id,
          name: l.name,
          taskDefinitionIds: l.taskDefinitionIds ?? [],
        })) ?? []
      ),
    ])
      .then(([t, loc]) => {
        setTasks(t);
        setLocations(loc);

        const firstLoc = loc[0];
        if (firstLoc) {
          setLocationId(firstLoc.id);
          const firstTaskForLocation = t.find((task) => firstLoc.taskDefinitionIds.includes(task.id));
          if (firstTaskForLocation) setTaskId(firstTaskForLocation.id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const selectedLocation = locations.find((l) => l.id === locationId);
  const tasksForLocation = selectedLocation
    ? tasks.filter((t) => (selectedLocation?.taskDefinitionIds ?? []).includes(t.id))
    : [];

  const selectedTask = tasks.find((t) => t.id === taskId);
  const selectedTaskStateOptions: string[] = (() => {
    const raw = selectedTask?.stateOptions ?? null;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === "string") {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        // ignore
      }
    }
    return [];
  })();

  async function submit() {
    if (!id || !taskId || !locationId || value === "" || !selectedTask) return;
    setError("");
    setSending(true);
    try {
      const payloadValue =
        selectedTask.progressValueType === "state" ? value : Number(value);
      await api(`/projects/${id}/progress`, {
        method: "POST",
        body: JSON.stringify({
          taskDefinitionId: taskId,
          locationId,
          value: payloadValue,
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

      <Text style={{ color: "#71717a", marginBottom: 8 }}>Paso 1/3: Ubicación</Text>
      <View style={{ marginBottom: 16 }}>
        {locations.map((loc) => (
          <Pressable
            key={loc.id}
            onPress={() => {
              setLocationId(loc.id);
              setTaskId("");
              setValue("");
            }}
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

      <Text style={{ color: "#71717a", marginBottom: 8 }}>Paso 2/3: Tarea</Text>
      <View style={{ marginBottom: 16 }}>
        {!locationId ? (
          <Text style={{ color: "#71717a", marginBottom: 8 }}>Seleccioná primero una ubicación.</Text>
        ) : tasksForLocation.length === 0 ? (
          <Text style={{ color: "#71717a", marginBottom: 8 }}>Esta ubicación no tiene tareas asociadas.</Text>
        ) : (
          tasksForLocation.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => {
              setTaskId(t.id);
              setValue("");
            }}
            style={{
              padding: 12,
              backgroundColor: taskId === t.id ? "#1e3a5f" : "#18181c",
              borderRadius: 8,
              marginBottom: 4,
              borderWidth: 1,
              borderColor: "#2a2a30",
            }}
          >
            <Text style={{ color: "#e4e4e7" }}>
              {t.name} ({t.progressValueType})
            </Text>
          </Pressable>
          ))
        )}
      </View>

      <Text style={{ color: "#71717a", marginBottom: 8 }}>Paso 3/3: Valor</Text>
      {selectedTask?.progressValueType === "state" ? (
        <View style={{ marginBottom: 20 }}>
          {selectedTaskStateOptions.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => setValue(opt)}
              style={{
                padding: 12,
                backgroundColor: value === opt ? "#1e3a5f" : "#18181c",
                borderRadius: 8,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: "#2a2a30",
              }}
            >
              <Text style={{ color: "#e4e4e7" }}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
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
          placeholder={selectedTask?.progressValueType === "quantity" ? "Ej: 25.5" : "Ej: 100"}
          placeholderTextColor="#71717a"
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
        />
      )}

      <Pressable
        onPress={submit}
        disabled={sending || !taskId || value === ""}
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
