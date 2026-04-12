import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { AppError } from '../utils/helpers.js';

export const errorHandler = (err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  const { statusCode = 500, message, isOperational } = err;

  if (!isOperational) {
    logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  }

  const response: {
    success: boolean;
    error: string;
    stack?: string;
  } = {
    success: false,
    error: config.isDev && !isOperational ? 'Internal Server Error' : message,
  };

  if (config.isDev) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  const err = new AppError(`Route not found: ${req.originalUrl}`, 404);
  next(err);
};