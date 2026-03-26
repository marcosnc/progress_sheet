import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    SecureStore.getItemAsync("token").then((token) => {
      if (token) router.replace("/projects");
    });
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0f0f12" }}>
      <Text style={{ fontSize: 24, color: "#e4e4e7", marginBottom: 8 }}>Progress Sheet</Text>
      <Text style={{ color: "#71717a", marginBottom: 32 }}>
        Seguimiento de avance de obras
      </Text>
      <Pressable
        onPress={() => router.push("/login")}
        style={{
          backgroundColor: "#3b82f6",
          padding: 14,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>Iniciar sesión</Text>
      </Pressable>
    </View>
  );
}
