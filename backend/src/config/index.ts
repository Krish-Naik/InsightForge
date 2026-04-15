import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  port:              number;
  nodeEnv:           string;
  mongoUri:          string;
  redis: {
    url: string;
    ttl: number;          // default TTL in seconds
    scannerTtl: number;  // scanner cache TTL
  };
  jwt: { secret: string; expire: string };
  rateLimit: { windowMs: number; max: number };
  ai: {
    enabled: boolean;
    provider: 'groq' | 'xai' | 'custom' | null;
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutMs: number;
  };
  isProd: boolean;
  isDev:  boolean;
}

const hasCustomKey = Boolean(process.env.AI_INSIGHTS_API_KEY);
const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
const hasXaiKey = Boolean(process.env.GROK_API_KEY || process.env.XAI_API_KEY);

const aiProvider: Config['ai']['provider'] = hasCustomKey
  ? 'custom'
  : hasGroqKey
    ? 'groq'
    : hasXaiKey
      ? 'xai'
      : null;

const aiApiKey = process.env.AI_INSIGHTS_API_KEY
  || process.env.GROQ_API_KEY
  || process.env.GROK_API_KEY
  || process.env.XAI_API_KEY
  || '';

const defaultBaseUrl = aiProvider === 'groq'
  ? 'https://api.groq.com/openai/v1'
  : 'https://api.x.ai/v1';

const defaultModel = aiProvider === 'groq'
  ? 'llama-3.1-8b-instant'
  : 'grok-3-mini';

export const config: Config = {
  port:    parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri:process.env.MONGODB_URI || 'mongodb://localhost:27017/insightforge',
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.REDIS_TTL || '60', 10),
    scannerTtl: parseInt(process.env.REDIS_SCANNER_TTL || '300', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION',
    expire: process.env.JWT_EXPIRE || '7d',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS   || '900000', 10),
    max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200',    10),
  },
  ai: {
    enabled: Boolean(aiApiKey),
    provider: aiProvider,
    apiKey: aiApiKey,
    baseUrl: process.env.AI_INSIGHTS_BASE_URL || defaultBaseUrl,
    model: process.env.AI_INSIGHTS_MODEL || defaultModel,
    timeoutMs: parseInt(process.env.AI_INSIGHTS_TIMEOUT_MS || '12000', 10),
  },
  isProd: process.env.NODE_ENV === 'production',
  isDev:  process.env.NODE_ENV !== 'production',
};
