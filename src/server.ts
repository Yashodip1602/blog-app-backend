import 'dotenv/config';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';
import config from './config';
import sequelize from './config/database';
import path from 'path';
import { testUploadConnection } from './utils/upload';
import { seedRoles } from './service/role-seed.service';

// ─── Plugins ─────────────────────────────────────────────────────────────────
// import authPlugin from './plugins/auth.plugin';

// ─── Routes ──────────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.routes';
import uploadRoutes from './routes/upload.routes';
// import userRoutes from './routes/users/user.routes';
// import postRoutes from './routes/posts/post.routes';
// import commentRoutes from './routes/posts/comment.routes';
// import adminRoutes from './routes/admin/admin.routes';

// ─────────────────────────────────────────────────────────────────────────────
// Build Fastify app
// ─────────────────────────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      transport: config.server.isDev
        ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
        : undefined,
      level: config.server.isDev ? 'debug' : 'info',
    },
    ajv: {
      customOptions: {
        removeAdditional: 'all',
        coerceTypes: true,
        useDefaults: true,
      },
    },
    trustProxy: true,
  });

  // ── CORS ──────────────────────────────────────────────────────────────────
  await app.register(fastifyCors, {
    origin: config.cors.allowedOrigins.map((origin) => origin),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  await app.register(fastifyRateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      success: false,
      message: 'Too many requests — please slow down',
    }),
  });

  // ── JWT ───────────────────────────────────────────────────────────────────
  await app.register(fastifyJwt, {
    secret: config.jwt.secret,
  });

  // ── Multipart (file upload) ───────────────────────────────────────────────
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: config.upload.maxFileSizeMB * 1024 * 1024,
    },
  });

  // ── Auth plugin (decorates authenticate + authorize) ──────────────────────
  // await app.register(authPlugin);

  // ─────────────────────────────────────────────────────────────────────────
  // Health check endpoint
  // ─────────────────────────────────────────────────────────────────────────

  app.get('/health', async (_req, reply) => {
    return reply.send({
      status_code: 200,
      success: true,
      message: 'ok',
      uptime: process.uptime(),
    });
  });

  // ── Root ──────────────────────────────────────────────────────────────────
  app.get('/', async (_req, reply) => {
    return reply.send({
      status_code: 200,
      success: true,
      name: 'BlogSphere API',
      version: '1.0.0',
      docs: `/docs`,
      health: `/health`,
    });
  });

// ── Seed Roles ──────────────────────────────────────────────────────────
  try {
    await seedRoles();
    app.log.info('Roles seeded successfully');
  } catch (error) {
    app.log.error(error);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Route registration  (all under /api)
  // ─────────────────────────────────────────────────────────────────────────

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(uploadRoutes, { prefix: '/api/uploads' });
  // await app.register(userRoutes, { prefix: '/api/users' });
  // await app.register(postRoutes, { prefix: '/api/posts' });
  // await app.register(commentRoutes, { prefix: '/api/posts' }); // /:postId/comments
  // await app.register(adminRoutes, { prefix: '/api/admin' });

  // ─────────────────────────────────────────────────────────────────────────
  // Global error handler
  // ─────────────────────────────────────────────────────────────────────────

  app.setErrorHandler((error, _req, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      app.log.error(error);
    }

    // Fastify validation errors
    if (error.validation) {
      return reply.code(400).send({
        success: false,
        message: 'Validation failed',
        errors: error.validation,
      });
    }

    return reply.code(statusCode).send({
      success: false,
      message: statusCode === 500 ? 'Internal server error' : error.message,
      ...(config.server.isDev && statusCode === 500 ? { stack: error.stack } : {}),
    });
  });

  // 404 handler
  app.setNotFoundHandler((_req, reply) => {
    return reply.code(404).send({
      success: false,
      message: `Route not found`,
    });
  });

  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║        BlogSphere API  — Fastify         ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');

  // 1. Verify DB connection
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  // 2. Run migrations (idempotent — safe to run on every boot)
  try {
    await sequelize.sync({ alter: true });
    console.log('Database synchronized successfully.');
  } catch (error) {
    console.error('Database synchronization failed:', error);
    process.exit(1);
  }

  // 3. Verify upload provider connection
  await testUploadConnection();

  // 4. Build and start Fastify
  const app = await buildApp();

  try {
    const address = await app.listen({
      port: config.server.port,
      host: config.server.host,
    });

    console.log('');
    console.log(`Server running at       ${address}`);
    console.log(`Health check at         ${address}/health`);
    console.log('');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // ── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n🛑 Received ${signal} — shutting down gracefully...`);
    await app.close();
    await sequelize.close();
    console.log('Server closed');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    process.exit(1);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
