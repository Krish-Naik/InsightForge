import dotenv from 'dotenv';
dotenv.config();

export type UpstoxAuthMode =
  | 'missing'
  | 'access_token'
  | 'access_token_via_auth_code_field'
  | 'auth_code'
  | 'credentials_only';

export interface Config {
  port:              number;
  nodeEnv:           string;
  demoMode:          boolean;
  mongoUri:          string;
  jwt: { secret: string; expire: string };
  newsApiKey:        string;
  upstoxAccessToken: string;
  upstoxApiKey:      string;
  upstoxApiSecret:   string;
  upstoxAuthCode:    string;
  upstoxRedirectUri: string;
  rateLimit: { windowMs: number; max: number };
  isProd: boolean;
  isDev:  boolean;
}

function normalizeEnv(value?: string): string {
  return `${value || ''}`.trim();
}

export function looksLikeJwtToken(value: string): boolean {
  const token = normalizeEnv(value);
  if (!token) return false;

  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part));
}

export function getUpstoxAuthMode(config: Pick<Config, 'upstoxAccessToken' | 'upstoxApiKey' | 'upstoxApiSecret' | 'upstoxAuthCode'>): UpstoxAuthMode {
  if (normalizeEnv(config.upstoxAccessToken)) return 'access_token';
  if (looksLikeJwtToken(config.upstoxAuthCode)) return 'access_token_via_auth_code_field';
  if (normalizeEnv(config.upstoxApiKey) && normalizeEnv(config.upstoxApiSecret) && normalizeEnv(config.upstoxAuthCode)) {
    return 'auth_code';
  }
  if (normalizeEnv(config.upstoxApiKey) && normalizeEnv(config.upstoxApiSecret)) return 'credentials_only';
  return 'missing';
}

export const config: Config = {
  port:    parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  demoMode: process.env.DEMO_MODE === 'true',
  mongoUri:process.env.MONGODB_URI || 'mongodb://localhost:27017/stockpulse',
  jwt: {
    secret: process.env.JWT_SECRET || 'CHANGE_ME_IN_PRODUCTION',
    expire: process.env.JWT_EXPIRE || '7d',
  },
  newsApiKey:        process.env.NEWS_API_KEY        || '',
  upstoxAccessToken: process.env.UPSTOX_ACCESS_TOKEN || '',
  upstoxApiKey:      process.env.UPSTOX_API_KEY      || '',
  upstoxApiSecret:   process.env.UPSTOX_API_SECRET   || '',
  upstoxAuthCode:    process.env.UPSTOX_AUTH_CODE    || '',
  upstoxRedirectUri: process.env.UPSTOX_REDIRECT_URI || 'http://localhost:5001/callback',
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS   || '900000', 10),
    max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200',    10),
  },
  isProd: process.env.NODE_ENV === 'production',
  isDev:  process.env.NODE_ENV !== 'production',
};
