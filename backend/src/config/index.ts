import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  port:              number;
  nodeEnv:           string;
  mongoUri:          string;
  jwt: { secret: string; expire: string };
  rateLimit: { windowMs: number; max: number };
  isProd: boolean;
  isDev:  boolean;
}

export const config: Config = {
  port:    parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri:process.env.MONGODB_URI || 'mongodb://localhost:27017/stockpulse',
  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION',
    expire: process.env.JWT_EXPIRE || '7d',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS   || '900000', 10),
    max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200',    10),
  },
  isProd: process.env.NODE_ENV === 'production',
  isDev:  process.env.NODE_ENV !== 'production',
};
