import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Progress Sheet" }} />
      <Stack.Screen name="login" options={{ title: "Iniciar sesión" }} />
      <Stack.Screen name="projects" options={{ title: "Obras" }} />
      <Stack.Screen name="project/[id]" options={{ title: "Proyecto" }} />
      <Stack.Screen name="project/[id]/record" options={{ title: "Registrar avance" }} />
    </Stack>
  );
}
