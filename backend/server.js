import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Route handlers
import healthRoutes from './routes/health.routes.js';
import overviewRoutes from './routes/overview.routes.js';
import instancesRoutes from './routes/instances.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import costsRoutes from './routes/costs.routes.js';
import alertsRoutes from './routes/alerts.routes.js';
import recommendationsRoutes from './routes/recommendations.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import monitoringRoutes from './routes/monitoring.routes.js';

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// CORS Configuration
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);

// Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Non-sensitive Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/overview', overviewRoutes);
app.use('/api/instances', instancesRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/costs', costsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Root route for API welcome / quick verification
app.get('/', (req, res) => {
  res.json({
    service: 'Cloud Infrastructure Health and Cost Intelligence API',
    version: '1.0.0',
    endpoints: [
      '/api/health',
      '/api/overview',
      '/api/instances',
      '/api/metrics',
      '/api/costs',
      '/api/alerts',
      '/api/recommendations',
      '/api/inventory/instances',
      '/api/inventory/volumes',
      '/api/inventory/elastic-ips',
      '/api/monitoring'
    ]
  });
});

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route Not Found',
    path: req.originalUrl,
    status: 404
  });
});

// Centralized Error Handling Middleware (never leaks secrets or AWS tokens)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(`[API Error] ${err.name || 'Error'}: ${err.message}`);

  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
    status: statusCode,
    ...(NODE_ENV === 'development' && { details: err.stack?.split('\n').slice(0, 3) })
  });
});

let server = null;

export function startServer(port = PORT) {
  return new Promise((resolve) => {
    server = app.listen(port, () => {
      console.log(`=======================================================`);
      console.log(` Cloud Infrastructure Health & Cost Intelligence API`);
      console.log(` Server running on http://localhost:${port}`);
      console.log(` Environment: ${NODE_ENV}`);
      console.log(` Mode Setting: ${process.env.DEMO_MODE || 'auto'}`);
      console.log(`=======================================================`);
      resolve(server);
    });
  });
}

export function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

// Graceful Shutdown
function handleShutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  stopServer().then(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forcefully terminating process after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Auto-start if invoked directly via `node server.js`
const currentFile = fileURLToPath(import.meta.url);
const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (executedFile === currentFile || executedFile.endsWith('server.js')) {
  startServer(PORT);
}

export default app;

