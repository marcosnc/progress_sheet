const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export async function api<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): Promise<T> {
  const { params, ...init } = options;
  let url = `${API_BASE}${path}`;
  if (params && Object.keys(params).length > 0) {
    url += "?" + new URLSearchParams(params).toString();
  }
  const token = getToken();
  const hasBody = init.body !== undefined && init.body !== null;
  const headers: HeadersInit = {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(init.headers as HeadersInit),
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Login failed");
  }
  return res.json() as Promise<{ token: string; userId: string; tenantId: string; role: string }>;
}

export const projectsApi = {
  list: () => api<{ projects: { id: string; name: string; createdAt: string }[] }>("/projects"),
  get: (id: string) =>
    api<{
      id: string;
      name: string;
      locations: { id: string; name: string; path: string }[];
      planVersions: { id: string; version: number }[];
    }>(`/projects/${id}`),
  create: (name: string) =>
    api<{ id: string; name: string }>("/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  update: (id: string, name: string) =>
    api<{ id: string; name: string }>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  delete: (id: string) => api(`/projects/${id}`, { method: "DELETE" }),
};

export const plansApi = {
  list: (projectId: string) =>
    api<{ plans: { id: string; version: number; taskDefinitions: { id: string; name: string; progressValueType: string; quantityUnit?: string | null; stateOptions?: string | null; dimensionValues?: string | null; parentTaskDefinitionId?: string | null }[] }[] }>(
      `/projects/${projectId}/plans`
    ),
  get: (projectId: string, planId: string) =>
    api<{
      id: string;
      version: number;
      taskDefinitions: { id: string; name: string; progressValueType: string; quantityUnit?: string | null; stateOptions?: string | null; dimensionValues?: string | null; parentTaskDefinitionId?: string | null }[];
      taskDependencies: unknown[];
    }>(`/projects/${projectId}/plans/${planId}`),
  create: (projectId: string) =>
    api<{ id: string; version: number }>(`/projects/${projectId}/plans`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  addTask: (
    projectId: string,
    planId: string,
    body: { name: string; progressValueType: "percent" | "quantity" | "state"; quantityUnit?: string | null; stateOptions?: string[] | null; dimensionValues?: Record<string, string>; parentTaskDefinitionId?: string | null }
  ) =>
    api<{ id: string; name: string }>(`/projects/${projectId}/plans/${planId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ ...body, planVersionId: planId }),
    }),
  updateTask: (
    projectId: string,
    planId: string,
    taskId: string,
    body: { name?: string; progressValueType?: "percent" | "quantity" | "state"; quantityUnit?: string | null; stateOptions?: string[] | null; dimensionValues?: Record<string, string>; parentTaskDefinitionId?: string | null }
  ) =>
    api<{ id: string; name: string }>(`/projects/${projectId}/plans/${planId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

export const locationLevelsApi = {
  list: () =>
    api<{ levels: { id: string; name: string; order: number }[] }>("/location-levels"),
  create: (name: string, order: number) =>
    api<{ id: string; name: string; order: number }>("/location-levels", {
      method: "POST",
      body: JSON.stringify({ name, order }),
    }),
  delete: (levelId: string) =>
    api(`/location-levels/${levelId}`, { method: "DELETE" }),
};

export const locationsApi = {
  list: (projectId: string) =>
    api<{ locations: { id: string; name: string; path: string; parentId: string | null; levelId: string; taskDefinitionIds: string[] }[] }>(
      `/projects/${projectId}/locations`
    ),
  create: (
    projectId: string,
    body: { parentId: string | null; levelId: string; name: string; taskDefinitionIds?: string[] }
  ) =>
    api<{ id: string; name: string; path: string; taskDefinitionIds: string[] }>(`/projects/${projectId}/locations`, {
      method: "POST",
      body: JSON.stringify({ ...body, projectId }),
    }),
  replicate: (
    projectId: string,
    body: { parentId: string | null; levelId: string; namePrefix?: string; count: number; taskDefinitionIds?: string[] }
  ) =>
    api<{ locations: { id: string; name: string; path: string; taskDefinitionIds: string[] }[] }>(
      `/projects/${projectId}/locations/replicate`,
      { method: "POST", body: JSON.stringify(body) }
    ),
  update: (
    projectId: string,
    locationId: string,
    body: { name?: string; parentId?: string | null; taskDefinitionIds?: string[] }
  ) =>
    api<{ id: string; name: string; path: string; taskDefinitionIds: string[] }>(
      `/projects/${projectId}/locations/${locationId}`,
      { method: "PATCH", body: JSON.stringify(body) }
    ),
  delete: (projectId: string, locationId: string) =>
    api(`/projects/${projectId}/locations/${locationId}`, { method: "DELETE" }),
  replicateFrom: (
    projectId: string,
    locationId: string,
    body: { count: number; namePrefix?: string }
  ) =>
    api<{ locations: { id: string; name: string; path: string; taskDefinitionIds: string[] }[] }>(
      `/projects/${projectId}/locations/replicate-from/${locationId}`,
      { method: "POST", body: JSON.stringify(body) }
    ),
};

export const dimensionsApi = {
  list: () =>
    api<{ dimensions: { id: string; name: string; key: string; order: number }[] }>("/dimensions"),
  create: (body: { name: string; key: string; order?: number }) =>
    api<{ id: string; name: string; key: string; order: number }>("/dimensions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  delete: (id: string) => api(`/dimensions/${id}`, { method: "DELETE" }),
};

export const progressApi = {
  get: (projectId: string, params?: { groupBy?: "task" | "location" | "none" }) =>
    api<{ items?: { taskDefinitionId: string; locationId: string; value: number | string }[]; byTask?: Record<string, unknown>; byLocation?: Record<string, unknown> }>(
      `/projects/${projectId}/progress`,
      { params: params as Record<string, string> }
    ),
  getState: (projectId: string) =>
    api<{ items: { taskDefinitionId: string; locationId: string; value: number | string }[] }>(
      `/projects/${projectId}/progress/state`
    ),
  record: (projectId: string, body: { taskDefinitionId: string; locationId: string; value: number | string; delta?: number }) =>
    api<{ id: string }>(`/projects/${projectId}/progress`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const projectionsApi = {
  velocity: (projectId: string) =>
    api<{ projections: { taskDefinitionId: string; locationId: string; ratePerDay: number; daysToComplete: number | null; currentValue: number }[] }>(
      `/projects/${projectId}/projections/velocity`
    ),
};
