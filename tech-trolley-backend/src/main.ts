import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import express from "express";
import { commands, z } from "@tech-trolley/contracts";
import { AppModule } from "./app.module";
import { connect, db } from "./database/database";
import { Errors } from "./common/errors";
export async function createApp() {
  await connect();
  const app = await NestFactory.create(AppModule, {
    logger: ["warn", "error"],
  });
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: "64kb" }));
  const origins = (process.env.WEB_ORIGIN || "http://localhost:3001").split(
    ",",
  );
  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      "X-Native-Client",
    ],
    methods: ["GET", "POST", "PATCH"],
  });
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      res.setHeader("Cache-Control", "no-store");
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        req.cookies?.tt_session &&
        !req.headers.authorization
      ) {
        if (!req.headers.origin || !origins.includes(req.headers.origin))
          return res.status(403).json({ code: "ORIGIN_REJECTED" });
      }
      next();
    },
  );
  app.useGlobalFilters(new Errors());
  const server = app.getHttpAdapter().getInstance();
  server.get("/health", async (_req: any, res: any) => {
    try {
      await db.query("SELECT 1 FROM schema_migration LIMIT 1");
      const revision = process.env.RENDER_GIT_COMMIT;
      res.json({
        status: "ok",
        ...(revision && /^[a-f0-9]{40}$/i.test(revision) ? { revision } : {}),
      });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Tech Trolley internal API")
      .setVersion("1.1")
      .addCookieAuth("tt_session")
      .addBearerAuth()
      .build(),
  );
  for (const [kind, schema] of Object.entries(commands))
    doc.paths[`/commands/${kind}`] = {
      post: {
        summary: `Post ${kind} atomically`,
        security: [{ cookie: [] }, { bearer: [] }],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: z.toJSONSchema(schema) as any },
          },
        },
        responses: {
          201: { description: "Committed authoritative document" },
          409: { description: "Stock, balance, due or idempotency conflict" },
        },
      },
    };
  SwaggerModule.setup("openapi", app, doc);
  server.get("/openapi.json", (_req: any, res: any) => res.json(doc));
  app.enableShutdownHooks();
  return app;
}
if (require.main === module)
  createApp()
    .then((app) => app.listen(Number(process.env.PORT || 3000), "0.0.0.0"))
    .catch(() => {
      console.error(
        "API startup failed. Check server configuration and migrations.",
      );
      process.exit(1);
    });
