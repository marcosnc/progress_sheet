import type { FastifyInstance } from "fastify";
import { applyImportSchema } from "@progress-sheet/shared";
import { requirePlanner } from "../auth.js";
import { prisma } from "../db.js";
import { exportProjectToXlsx } from "../data-transfer/export-service.js";
import { previewImport } from "../data-transfer/preview-service.js";
import { applyImportChanges } from "../data-transfer/import-apply-service.js";
import { getImportSession, deleteImportSession } from "../data-transfer/session-store.js";

export async function dataTransferRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const auth = await requirePlanner(request, reply);
    (request as { auth?: unknown }).auth = auth;
  });

  app.get("/projects/:projectId/data-export", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string; sub: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const buffer = await exportProjectToXlsx(auth.tenantId, projectId);
    const safeName = project.name.replace(/[^\w\-]+/g, "_").slice(0, 50);
    const date = new Date().toISOString().slice(0, 10);
    reply
      .header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
      .header("Content-Disposition", `attachment; filename="proyecto-${safeName}-${date}.xlsx"`)
      .send(buffer);
  });

  app.post("/projects/:projectId/data-import/preview", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string; sub: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const data = await request.file({ limits: { fileSize: 10 * 1024 * 1024 } });
    if (!data) return reply.status(400).send({ error: "Se requiere un archivo .xlsx" });

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const preview = await previewImport(auth.tenantId, projectId, auth.sub, buffer);
    return reply.send(preview);
  });

  app.post("/projects/:projectId/data-import/apply", async (request, reply) => {
    const auth = (request as { auth?: { tenantId: string; sub: string } }).auth!;
    const { projectId } = request.params as { projectId: string };
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId: auth.tenantId },
    });
    if (!project) return reply.status(404).send({ error: "Project not found" });

    const body = applyImportSchema.parse(request.body);
    const session = getImportSession(body.sessionId);
    if (!session) {
      return reply.status(400).send({ error: "Sesión de importación expirada o inválida" });
    }
    if (session.tenantId !== auth.tenantId || session.projectId !== projectId) {
      return reply.status(403).send({ error: "Sesión no corresponde a este proyecto" });
    }
    if (session.userId !== auth.sub) {
      return reply.status(403).send({ error: "Sesión iniciada por otro usuario" });
    }

    const result = await applyImportChanges(session, body.approvedChangeIds);
    deleteImportSession(body.sessionId);
    return reply.send(result);
  });
}
