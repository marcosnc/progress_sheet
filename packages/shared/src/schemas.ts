import { z } from "zod";

export const progressValueTypeSchema = z.enum(["percent", "quantity", "state"]);

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createLocationLevelSchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int(),
});

export const updateLocationLevelSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    order: z.number().int().optional(),
  })
  .refine((data) => data.name !== undefined || data.order !== undefined, {
    message: "Al menos uno de name u order debe enviarse",
  });

export const createLocationSchema = z.object({
  projectId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  levelId: z.string().uuid(),
  name: z.string().min(1).max(255),
  taskDefinitionIds: z.array(z.string().uuid()).optional(),
});

export const createPlanVersionSchema = z.object({
  projectId: z.string().uuid(),
});

export const createTaskDefinitionSchema = z.object({
  planVersionId: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
  parentTaskDefinitionId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  progressValueType: progressValueTypeSchema,
  quantityUnit: z.string().max(50).nullable().optional(),
  stateOptions: z.array(z.string().max(100)).nullable().optional(),
  dimensionValues: z.record(z.string(), z.string()).optional(),
});

export const updateTaskDefinitionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  progressValueType: progressValueTypeSchema.optional(),
  parentTaskDefinitionId: z.string().uuid().nullable().optional(),
  quantityUnit: z.string().max(50).nullable().optional(),
  stateOptions: z.array(z.string().max(100)).nullable().optional(),
  dimensionValues: z.record(z.string(), z.string()).optional(),
});

export const recordProgressSchema = z.object({
  taskDefinitionId: z.string().uuid(),
  locationId: z.string().uuid(),
  value: z.union([z.number(), z.string()]),
  delta: z.number().optional(),
});

export const recordProgressBatchSchema = z.object({
  events: z.array(recordProgressSchema).min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const aggregationStrategySchema = z.enum(["sum", "average", "last_state", "weighted"]);

export const createTaskDependencySchema = z.object({
  taskId: z.string().uuid(),
  dependsOnTaskId: z.string().uuid(),
});

export const createTaskTemplateSchema = z.object({
  name: z.string().min(1).max(255),
});

export const replicateLocationsSchema = z.object({
  parentId: z.string().uuid().nullable(),
  levelId: z.string().uuid(),
  namePrefix: z.string().min(1).max(100).optional(),
  count: z.number().int().min(1).max(500),
  taskDefinitionIds: z.array(z.string().uuid()).optional(),
});

export const updateLocationSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    parentId: z.string().uuid().nullable().optional(),
    taskDefinitionIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => data.name !== undefined || data.parentId !== undefined || data.taskDefinitionIds !== undefined, {
    message: "Al menos uno de name, parentId o taskDefinitionIds debe enviarse",
  });

export const replicateFromLocationSchema = z.object({
  count: z.number().int().min(1).max(500),
  namePrefix: z.string().min(1).max(100).optional(),
});

export const createDimensionSchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int().min(0).optional(),
});

export const updateDimensionSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    order: z.number().int().min(0).optional(),
  })
  .refine((data) => data.name !== undefined || data.order !== undefined, {
    message: "Al menos uno de name u order debe enviarse",
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type CreateTaskDefinitionInput = z.infer<typeof createTaskDefinitionSchema>;
export type RecordProgressInput = z.infer<typeof recordProgressSchema>;
