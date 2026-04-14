import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { isDbConnected } from '../config/database.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/helpers.js';

const requireDb = () => {
  if (!isDbConnected()) throw new AppError('MongoDB not connected — this feature requires a database', 503);
};

const signToken = (id: string) => jwt.sign({ id }, config.jwt.secret, {
  expiresIn: config.jwt.expire as any,
});

function normalizeWorkspaceId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48);
}

export const authController = {
  bootstrapWorkspace: asyncHandler(async (req: Request, res: Response) => {
    requireDb();

    const workspaceId = normalizeWorkspaceId(`${req.body.workspaceId || ''}`);
    const name = `${req.body.name || 'Workspace User'}`.trim().slice(0, 60) || 'Workspace User';

    if (workspaceId.length < 8) {
      throw new AppError('A valid workspace id is required', 400);
    }

    const email = `workspace+${workspaceId}@stockpulse.local`;
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        password: `workspace-${workspaceId}-${config.jwt.secret}`,
      });
    } else if (user.name !== name) {
      user.name = name;
      await user.save();
    }

    const token = signToken(user._id.toString());

    res.json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        token,
        workspace: true,
      },
    });
  }),

  register: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      throw new AppError('Email already registered', 400);
    }

    const user = await User.create({ name, email, password });
    const token = signToken(user._id.toString());

    res.status(201).json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        token,
      },
    });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = signToken(user._id.toString());

    res.json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        token,
      },
    });
  }),

  getMe: asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    res.json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email },
      },
    });
  }),
};