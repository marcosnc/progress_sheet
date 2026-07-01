import { z } from "zod";

export const applyImportSchema = z.object({
  sessionId: z.string().uuid(),
  approvedChangeIds: z.array(z.string().uuid()),
});
