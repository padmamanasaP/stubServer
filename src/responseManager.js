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
    // Only start watching if not in test mode (to allow tests to exit)
    if (process.env.NODE_ENV !== 'test') {
      this.startWatching();
    }
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

  getResponseFile(lookupValue, category = null) {
    if (!lookupValue) {
      // If category exists and has a default, use it, otherwise use global default
      if (category) {
        const sanitizedCategory = String(category).replace(/[^a-zA-Z0-9_-]/g, '_');
        const categoryDir = path.join(this.responseDir, sanitizedCategory);
        const categoryDefaultPath = path.join(categoryDir, this.defaultResponse);
        if (fs.existsSync(categoryDir) && fs.statSync(categoryDir).isDirectory() && 
            fs.existsSync(categoryDefaultPath)) {
          return path.join(sanitizedCategory, this.defaultResponse);
        }
      }
      return this.defaultResponse;
    }

    // Sanitize lookup value to prevent directory traversal
    const sanitized = String(lookupValue).replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // If category is provided, try hierarchical lookup first
    if (category) {
      const sanitizedCategory = String(category).replace(/[^a-zA-Z0-9_-]/g, '_');
      const categoryDir = path.join(this.responseDir, sanitizedCategory);
      
      // Check if category directory exists
      if (fs.existsSync(categoryDir) && fs.statSync(categoryDir).isDirectory()) {
        // Try to find specific file in category directory
        const categoryResponseFile = this._findFileInDirectory(categoryDir, sanitized);
        if (categoryResponseFile) {
          return path.join(sanitizedCategory, categoryResponseFile);
        }
        
        // Try category-level default
        const categoryDefaultPath = path.join(categoryDir, this.defaultResponse);
        if (fs.existsSync(categoryDefaultPath)) {
          return path.join(sanitizedCategory, this.defaultResponse);
        }
        // Category directory exists but no matching file - return category default path
        // (will fall back to global default in getResponse if file doesn't exist)
        return path.join(sanitizedCategory, this.defaultResponse);
      }
      // If category directory doesn't exist, return global default (AC4)
      return this.defaultResponse;
    }
    
    // Fallback to flat lookup for backward compatibility
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
      `transaction_${sanitized}.json`,
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

  _findFileInDirectory(directory, sanitizedValue) {
    // Derive prefix from lookup field name if it contains underscore
    let derivedPrefix = null;
    if (this.lookupField && this.lookupField.includes('_')) {
      derivedPrefix = this.lookupField.split('_')[0] + '_';
    }

    // Build patterns: derived prefix, common prefixes, and exact match
    const patterns = [];
    
    if (derivedPrefix) {
      patterns.push(`${derivedPrefix}${sanitizedValue}.json`);
    }
    
    // Add common patterns
    patterns.push(
      `user_${sanitizedValue}.json`,
      `order_${sanitizedValue}.json`,
      `payment_${sanitizedValue}.json`,
      `resource_${sanitizedValue}.json`,
      `transaction_${sanitizedValue}.json`,
      `${sanitizedValue}.json`
    );

    for (const pattern of patterns) {
      const testPath = path.join(directory, pattern);
      if (fs.existsSync(testPath)) {
        return pattern;
      }
    }

    return null;
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

  /**
   * Apply template substitution to response data
   * Replaces placeholders like {{request.fieldName}} with values from requestData
   * @param {Object} responseData - The response object (can be nested)
   * @param {Object} requestData - The request data (query params + body)
   * @returns {Object} - Response with templates applied
   */
  applyTemplating(responseData, requestData = {}) {
    if (!responseData || typeof responseData !== 'object') {
      return responseData;
    }

    if (Array.isArray(responseData)) {
      return responseData.map(item => this.applyTemplating(item, requestData));
    }

    const result = {};
    for (const [key, value] of Object.entries(responseData)) {
      if (typeof value === 'string') {
        result[key] = this.replacePlaceholders(value, requestData);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.applyTemplating(value, requestData);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Replace placeholders in a string with values from requestData
   * Supports patterns like {{request.fieldName}} and {{request.nested.field}}
   * @param {string} template - String that may contain placeholders
   * @param {Object} requestData - Request data to substitute
   * @returns {string} - String with placeholders replaced
   */
  replacePlaceholders(template, requestData) {
    if (typeof template !== 'string') {
      return template;
    }

    const placeholderRegex = /\{\{request\.([a-zA-Z0-9_.]+)\}\}/g;
    
    return template.replace(placeholderRegex, (match, fieldPath) => {
      const value = this.getNestedValue(requestData, fieldPath);
      
      if (value === undefined || value === null) {
        this.logger.debug('Template placeholder not found in request data', {
          placeholder: match,
          fieldPath
        });
        return match;
      }
      
      return String(value);
    });
  }

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Object to traverse
   * @param {string} path - Dot-separated path (e.g., "user.name" or "transactionId")
   * @returns {*} - Value at the path, or undefined if not found
   */
  getNestedValue(obj, path) {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Load delay configuration from config.json in the response directory
   * @param {string} category - Category directory to check for config.json
   * @returns {number} - Delay in milliseconds, or 0 if no config found
   */
  loadDelayConfig(category = null) {
    if (!category) {
      return 0;
    }

    const sanitizedCategory = String(category).replace(/[^a-zA-Z0-9_-]/g, '_');
    const configPath = path.join(this.responseDir, sanitizedCategory, 'config.json');

    if (!fs.existsSync(configPath)) {
      return 0;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(content);
      
      if (config.delay && typeof config.delay === 'number' && config.delay > 0) {
        this.logger.debug('Delay configuration loaded', {
          category,
          delay: config.delay
        });
        return config.delay;
      }
      
      return 0;
    } catch (error) {
      this.logger.warn('Error loading delay config', {
        configPath,
        error: error.message
      });
      return 0;
    }
  }

  getResponse(lookupValue, category = null, requestData = {}) {
    const filename = this.getResponseFile(lookupValue, category);
    const response = this.loadResponse(filename);
    const delay = this.loadDelayConfig(category);
    
    // If response was loaded successfully, apply templating and return it
    if (response) {
      const templatedResponse = this.applyTemplating(response, requestData);
      
      const hasTemplates = JSON.stringify(response).includes('{{request.');
      if (hasTemplates) {
        this.logger.debug('Template rendering applied', {
          filename,
          requestDataKeys: Object.keys(requestData)
        });
      }
      
      return { response: templatedResponse, delay };
    }
    
    // If response failed to load and it's not already a default file, try fallbacks
    const isDefaultFile = filename === this.defaultResponse || 
                         (category && filename === path.join(category, this.defaultResponse));
    
    if (!isDefaultFile) {
      // Fallback to default if specific file failed
      this.logger.debug('Falling back to default response', {
        requested: filename,
        category
      });
      
      // Try category default first if category exists
      if (category) {
        const categoryDefault = path.join(category, this.defaultResponse);
        const categoryResponse = this.loadResponse(categoryDefault);
        if (categoryResponse) {
          return { 
            response: this.applyTemplating(categoryResponse, requestData), 
            delay 
          };
        }
      }
      
      // Fallback to global default
      const globalDefault = this.loadResponse(this.defaultResponse);
      if (globalDefault) {
        return { 
          response: this.applyTemplating(globalDefault, requestData), 
          delay: 0
        };
      }
    }

    return {
      response: {
        status: 'error',
        message: 'No response file available'
      },
      delay: 0
    };
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.logger.info('File watcher stopped');
    }
  }
}

