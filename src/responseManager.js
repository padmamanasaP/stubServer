import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ResponseManager {
  constructor(responseDir, defaultResponse, lookupField, logger) {
    this.responseDir = path.resolve(responseDir);
    this.defaultResponse = defaultResponse;
    this.lookupField = lookupField;
    this.logger = logger;
    this.cache = new Map();
    this.watcher = null;
    this.initializeDirectory();
    this.startWatching();
  }

  initializeDirectory() {
    if (!fs.existsSync(this.responseDir)) {
      fs.mkdirSync(this.responseDir, { recursive: true });
      this.logger.info(`Created response directory: ${this.responseDir}`);
      
      // Create default.json if it doesn't exist
      const defaultPath = path.join(this.responseDir, this.defaultResponse);
      if (!fs.existsSync(defaultPath)) {
        fs.writeFileSync(defaultPath, JSON.stringify({
          status: 'success',
          message: 'Default response - no matching file found',
          timestamp: new Date().toISOString()
        }, null, 2));
      }
    }
  }

  startWatching() {
    // Watch for file changes, additions, and deletions
    this.watcher = chokidar.watch(this.responseDir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: false,
    });

    this.watcher
      .on('change', (filePath) => {
        this.logger.debug('Response file changed', { file: filePath });
        this.invalidateCache(filePath);
      })
      .on('add', (filePath) => {
        this.logger.debug('Response file added', { file: filePath });
        this.invalidateCache(filePath);
      })
      .on('unlink', (filePath) => {
        this.logger.debug('Response file deleted', { file: filePath });
        this.invalidateCache(filePath);
      });

    this.logger.info('File watching initialized for hot reload', {
      directory: this.responseDir
    });
  }

  invalidateCache(filePath) {
    const relativePath = path.relative(this.responseDir, filePath);
    if (this.cache.has(relativePath)) {
      this.cache.delete(relativePath);
      this.logger.debug('Cache invalidated', { file: relativePath });
    }
  }

  getResponseFile(lookupValue) {
    if (!lookupValue) {
      return this.defaultResponse;
    }

    // Sanitize lookup value to prevent directory traversal
    const sanitized = String(lookupValue).replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Try exact match first
    let responseFile = `${sanitized}.json`;
    let responsePath = path.join(this.responseDir, responseFile);
    
    if (fs.existsSync(responsePath)) {
      return responseFile;
    }

    // Derive prefix from lookup field name if it contains underscore
    // e.g., "user_id" -> "user_", "order_id" -> "order_"
    let derivedPrefix = null;
    if (this.lookupField && this.lookupField.includes('_')) {
      derivedPrefix = this.lookupField.split('_')[0] + '_';
    }

    // Build patterns: derived prefix, common prefixes, and exact match
    const patterns = [];
    
    if (derivedPrefix) {
      patterns.push(`${derivedPrefix}${sanitized}.json`);
    }
    
    // Add common patterns
    patterns.push(
      `user_${sanitized}.json`,
      `order_${sanitized}.json`,
      `resource_${sanitized}.json`,
      `${sanitized}.json`
    );

    for (const pattern of patterns) {
      const testPath = path.join(this.responseDir, pattern);
      if (fs.existsSync(testPath)) {
        return pattern;
      }
    }

    return this.defaultResponse;
  }

  loadResponse(filename) {
    // Check cache first
    if (this.cache.has(filename)) {
      return this.cache.get(filename);
    }

    const filePath = path.join(this.responseDir, filename);
    
    // Prevent directory traversal
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(this.responseDir))) {
      this.logger.warn('Attempted directory traversal blocked', { filename });
      return null;
    }

    if (!fs.existsSync(filePath)) {
      this.logger.warn('Response file not found', { filename });
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(content);
      this.cache.set(filename, jsonData);
      return jsonData;
    } catch (error) {
      this.logger.error('Error loading response file', {
        filename,
        error: error.message
      });
      return null;
    }
  }

  getResponse(lookupValue) {
    const filename = this.getResponseFile(lookupValue);
    const response = this.loadResponse(filename);
    
    if (!response && filename !== this.defaultResponse) {
      // Fallback to default if specific file failed
      this.logger.debug('Falling back to default response', {
        requested: filename
      });
      return this.loadResponse(this.defaultResponse);
    }

    return response || {
      status: 'error',
      message: 'No response file available'
    };
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.logger.info('File watcher stopped');
    }
  }
}

