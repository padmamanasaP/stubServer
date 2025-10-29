import fs from 'fs';
import path from 'path';

const logLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  constructor(level = 'info') {
    this.level = logLevels[level] || logLevels.info;
  }

  log(level, message, data = {}) {
    const levelNum = logLevels[level] || logLevels.info;
    if (levelNum >= this.level) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        message,
        ...data,
      };
      console.log(JSON.stringify(logEntry));
    }
  }

  info(message, data) {
    this.log('info', message, data);
  }

  debug(message, data) {
    this.log('debug', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  error(message, data) {
    this.log('error', message, data);
  }
}

export default Logger;

