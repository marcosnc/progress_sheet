import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { authRoutes } from "./routes/auth.js";
import { projectsRoutes } from "./routes/projects.js";
import { planRoutes } from "./routes/plan.js";
import { locationsRoutes } from "./routes/locations.js";
import { progressRoutes } from "./routes/progress.js";
import { locationLevelsRoutes } from "./routes/location-levels.js";
import { templatesRoutes } from "./routes/templates.js";
import { projectionsRoutes } from "./routes/projections.js";
import { dimensionsRoutes } from "./routes/dimensions.js";

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, { origin: true });
  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
  });

  app.decorate("authenticate", async function (request: unknown, reply: unknown) {
    try {
      await (app as unknown as { jwt: { verify: (x: unknown) => Promise<unknown> } }).jwt.verify(
        (request as { headers: { authorization?: string } }).headers?.authorization?.replace("Bearer ", "") ?? ""
      );
    } catch {
      (reply as { status: (n: number) => { send: (x: object) => void } }).status(401).send({ error: "Unauthorized" });
    }
  });

  app.register(authRoutes, { prefix: "/auth" });

  app.register(async (app) => {
    app.addHook("onRequest", async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    });
    app.register(projectsRoutes, { prefix: "/projects" });
    app.register(planRoutes, { prefix: "" });
    app.register(locationsRoutes, { prefix: "" });
    app.register(progressRoutes, { prefix: "" });
    app.register(locationLevelsRoutes, { prefix: "" });
    app.register(templatesRoutes, { prefix: "" });
    app.register(projectionsRoutes, { prefix: "" });
    app.register(dimensionsRoutes, { prefix: "" });
  }, { prefix: "/api" });

  app.get("/health", async () => ({ ok: true }));

  const host = process.env.HOST ?? "0.0.0.0";
  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ host, port });
  console.log(`Server listening on http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
