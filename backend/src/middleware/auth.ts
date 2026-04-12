import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/helpers.js';

export interface AuthRequest extends Request {
  user?: {
    _id: string;
    name: string;
    email: string;
    passwordChangedAt?: Date;
  };
}

export const auth = asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401);
  }

  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, config.jwt.secret) as { id: string; iat: number };

  const user = await User.findById(decoded.id).select('-password');
  if (!user) {
    throw new AppError('User not found', 401);
  }

  if (user.passwordChangedAt && user.passwordChangedAt.getTime() / 1000 > decoded.iat) {
    throw new AppError('Token expired. Please login again.', 401);
  }

  req.user = {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    passwordChangedAt: user.passwordChangedAt,
  };
  next();
});