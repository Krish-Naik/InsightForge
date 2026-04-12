import { Request, Response } from 'express';
import { isDbConnected } from '../config/database.js';
import { Portfolio, IHolding } from '../models/Portfolio.js';
import { AppError, asyncHandler } from '../utils/helpers.js';

const requireDb = () => {
  if (!isDbConnected()) throw new AppError('MongoDB not connected — this feature requires a database', 503);
};

export const portfolioController = {
  getAll: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const portfolios = await Portfolio.find({ user: user._id }).sort({ createdAt: 1 });
    res.json({ success: true, data: portfolios });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const { name } = req.body;
    const portfolio = await Portfolio.create({
      user: user._id,
      name: name || 'My Portfolio',
      holdings: [],
    });
    res.status(201).json({ success: true, data: portfolio });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const { name } = req.body;
    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: req.params.id, user: user._id },
      { name },
      { new: true, runValidators: true }
    );
    if (!portfolio) throw new AppError('Portfolio not found', 404);
    res.json({ success: true, data: portfolio });
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const portfolio = await Portfolio.findOneAndDelete({
      _id: req.params.id,
      user: user._id,
    });
    if (!portfolio) throw new AppError('Portfolio not found', 404);
    res.json({ success: true, message: 'Portfolio deleted' });
  }),

  addHolding: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const { symbol, name, qty, avgPrice, currentPrice, sector, exchange = 'NSE' } = req.body;

    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      user: user._id,
    });
    if (!portfolio) throw new AppError('Portfolio not found', 404);

    const existing = portfolio.holdings.find((h: any) => h.symbol === symbol);
    if (existing) {
      const totalQty = existing.qty + qty;
      existing.avgPrice = ((existing.avgPrice * existing.qty) + (avgPrice * qty)) / totalQty;
      existing.qty = totalQty;
      if (currentPrice) existing.currentPrice = currentPrice;
    } else {
      portfolio.holdings.push({ symbol, name, qty, avgPrice, currentPrice: currentPrice || avgPrice, sector, exchange });
    }

    await portfolio.save();
    res.json({ success: true, data: portfolio });
  }),

  updateHolding: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      user: user._id,
    });
    if (!portfolio) throw new AppError('Portfolio not found', 404);

    const holding = portfolio.holdings.find((h: IHolding) => h._id?.toString() === req.params.holdingId) || null;
    if (!holding) throw new AppError('Holding not found', 404);

    Object.assign(holding, req.body);
    await portfolio.save();

    res.json({ success: true, data: portfolio });
  }),

  removeHolding: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const portfolio = await Portfolio.findOne({
      _id: req.params.id,
      user: user._id,
    });
    if (!portfolio) throw new AppError('Portfolio not found', 404);

    portfolio.holdings = portfolio.holdings.filter((h: any) => h._id.toString() !== req.params.holdingId);
    await portfolio.save();

    res.json({ success: true, data: portfolio });
  }),
};