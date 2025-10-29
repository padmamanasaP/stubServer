import express from 'express';
import { config } from './config.js';
import Logger from './logger.js';
import { ResponseManager } from './responseManager.js';

const logger = new Logger(config.logLevel);
const responseManager = new ResponseManager(
  config.responseDir,
  config.defaultResponse,
  config.lookupField,
  logger
);

const app = express();

// Middleware for parsing JSON bodies
app.use(express.json());

// Middleware for parsing URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function(data) {
    const duration = Date.now() - startTime;
    logger.info('Request processed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
    return originalSend.call(this, data);
  };

  next();
});

// Extract category from URL path (e.g., /api/user -> user, /api/order -> order)
function extractCategory(req) {
  const urlPath = req.path || req.originalUrl.split('?')[0];
  
  // Remove leading slash and split
  const segments = urlPath.replace(/^\/+/, '').split('/');
  
  // If path starts with 'api', take the segment after it
  if (segments.length > 0 && segments[0].toLowerCase() === 'api') {
    return segments.length > 1 ? segments[1] : null;
  }
  
  // Otherwise, take the first segment
  return segments.length > 0 && segments[0] ? segments[0] : null;
}

// Extract lookup value from different sources
function extractLookupValue(req, lookupField) {
  // For GET requests, check query parameters
  if (req.method === 'GET') {
    return req.query[lookupField] || 
           req.query.user_id || 
           req.query.order_id || 
           req.query.resource_id ||
           req.query.payment_id ||
           req.query.id;
  }

  // For POST and DELETE, check body first
  if (req.body && typeof req.body === 'object') {
    return req.body[lookupField] ||
           req.body.user_id ||
           req.body.order_id ||
           req.body.resource_id ||
           req.body.payment_id ||
           req.body.id;
  }

  // Also check query params as fallback for POST/DELETE
  return req.query[lookupField] ||
         req.query.user_id ||
         req.query.order_id ||
         req.query.resource_id ||
         req.query.payment_id ||
         req.query.id;
}

// Generic handler for all methods
function handleRequest(req, res) {
  const lookupValue = extractLookupValue(req, config.lookupField);
  const category = extractCategory(req);
  
  logger.debug('Processing request', {
    method: req.method,
    url: req.originalUrl,
    lookupField: config.lookupField,
    lookupValue,
    category,
    body: req.body,
    query: req.query,
  });

  const response = responseManager.getResponse(lookupValue, category);
  
  logger.info('Response determined', {
    method: req.method,
    url: req.originalUrl,
    lookupValue,
    category,
    responseFile: responseManager.getResponseFile(lookupValue, category),
  });

  // Add response time simulation if needed (for performance testing)
  const delay = parseInt(req.query._delay || '0', 10);
  if (delay > 0 && delay < 5000) {
    setTimeout(() => {
      res.status(200).json(response);
    }, delay);
  } else {
    res.status(200).json(response);
  }
}

// Health check endpoint (must be before wildcard routes)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      responseDir: config.responseDir,
      lookupField: config.lookupField,
      defaultResponse: config.defaultResponse,
    },
  });
});

// Route handlers
app.get('*', handleRequest);
app.post('*', handleRequest);
app.delete('*', handleRequest);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error processing request', {
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
  });

  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  responseManager.stopWatching();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  responseManager.stopWatching();
  process.exit(0);
});

// Start server only if this file is run directly (not imported)
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMainModule) {
  const server = app.listen(config.port, () => {
    logger.info('Stub Test Server started', {
      port: config.port,
      responseDir: config.responseDir,
      lookupField: config.lookupField,
      defaultResponse: config.defaultResponse,
      environment: process.env.NODE_ENV || 'development',
    });
    
    console.log(`
╔════════════════════════════════════════════════════════╗
║         Stub Test Server - Running                    ║
╠════════════════════════════════════════════════════════╣
║  Port:            ${String(config.port).padEnd(38)}║
║  Response Dir:    ${String(config.responseDir).padEnd(38)}║
║  Lookup Field:    ${String(config.lookupField).padEnd(38)}║
║  Default File:    ${String(config.defaultResponse).padEnd(38)}║
╚════════════════════════════════════════════════════════╝

Server is ready to accept requests!
Health check: http://localhost:${config.port}/health
  `);
  });
}

export default app;

