import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  lookupField: process.env.LOOKUP_FIELD || 'id',
  responseDir: process.env.RESPONSE_DIR || './responses',
  defaultResponse: process.env.DEFAULT_RESPONSE || 'default.json',
  logLevel: process.env.LOG_LEVEL || 'info',
};

