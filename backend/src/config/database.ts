import mongoose from 'mongoose';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

let dbConnected = false;

export const connectDB = async () => {
  try {    
    const connOptions: any = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    };

    const conn = await mongoose.connect(config.mongoUri, connOptions);
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

    conn.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      dbConnected = true;
    });

    return conn;
  } catch (err) {
    dbConnected = false;
  }
};

export const isDbConnected = () => dbConnected;