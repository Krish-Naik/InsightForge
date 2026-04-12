import mongoose from 'mongoose';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

let dbConnected = false;

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri);
    dbConnected = true;
    logger.info(`MongoDB connected: ${conn.connection.host}`);

    conn.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
      dbConnected = false;
    });

    conn.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      dbConnected = false;
    });

    return conn;
  } catch (err) {
    logger.warn(`MongoDB not available — market data routes will still work, but auth/watchlists/portfolios require MongoDB`);
    dbConnected = false;
  }
};

export const isDbConnected = () => dbConnected;