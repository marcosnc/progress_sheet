import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

const API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api";

async function getToken() {
  return SecureStore.getItemAsync("token");
}

async function fetchProjects(): Promise<{ id: string; name: string }[]> {
  const token = await getToken();
  if (!token) throw new Error("No token");
  const res = await fetch(`${API}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al cargar proyectos");
  const data = await res.json();
  return data.projects ?? [];
}

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    getToken().then((t) => {
      if (!t) {
        router.replace("/login");
        return;
      }
      fetchProjects()
        .then(setProjects)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    });
  }, [router]);

  if (loading) {
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
    <View style={{ flex: 1, padding: 16, backgroundColor: "#0f0f12" }}>
      <Text style={{ fontSize: 24, color: "#e4e4e7", marginBottom: 16 }}>Obras</Text>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/project/[id]", params: { id: item.id } })}
            style={{
              padding: 16,
              backgroundColor: "#18181c",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#2a2a30",
              marginBottom: 8,
            }}
          >
            <Text style={{ color: "#e4e4e7", fontSize: 16 }}>{item.name}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
