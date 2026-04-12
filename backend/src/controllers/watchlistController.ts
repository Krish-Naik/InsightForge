import { Request, Response } from 'express';
import { isDbConnected } from '../config/database.js';
import { Watchlist } from '../models/Watchlist.js';
import { AppError, asyncHandler } from '../utils/helpers.js';

const requireDb = () => {
  if (!isDbConnected()) throw new AppError('MongoDB not connected — this feature requires a database', 503);
};

export const watchlistController = {
  getAll: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const watchlists = await Watchlist.find({ user: user._id }).sort({ createdAt: 1 });
    res.json({ success: true, data: watchlists });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const { name } = req.body;
    const watchlist = await Watchlist.create({
      user: user._id,
      name: name || 'My Watchlist',
      stocks: [],
    });
    res.status(201).json({ success: true, data: watchlist });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const { name } = req.body;
    const watchlist = await Watchlist.findOneAndUpdate(
      { _id: req.params.id, user: user._id },
      { name },
      { new: true, runValidators: true }
    );
    if (!watchlist) throw new AppError('Watchlist not found', 404);
    res.json({ success: true, data: watchlist });
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const watchlist = await Watchlist.findOneAndDelete({
      _id: req.params.id,
      user: user._id,
    });
    if (!watchlist) throw new AppError('Watchlist not found', 404);
    res.json({ success: true, message: 'Watchlist deleted' });
  }),

  addStock: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const { symbol, name, exchange = 'NSE' } = req.body;

    const watchlist = await Watchlist.findOne({
      _id: req.params.id,
      user: user._id,
    });
    if (!watchlist) throw new AppError('Watchlist not found', 404);

    const exists = watchlist.stocks.find((s: any) => s.symbol === symbol);
    if (exists) throw new AppError('Stock already in watchlist', 400);

    watchlist.stocks.push({ symbol, name, exchange });
    await watchlist.save();

    res.json({ success: true, data: watchlist });
  }),

  removeStock: asyncHandler(async (req: Request, res: Response) => {
    requireDb();
    const user = (req as any).user;
    const watchlist = await Watchlist.findOne({
      _id: req.params.id,
      user: user._id,
    });
    if (!watchlist) throw new AppError('Watchlist not found', 404);

    watchlist.stocks = watchlist.stocks.filter((s: any) => s.symbol !== req.params.symbol);
    await watchlist.save();

    res.json({ success: true, data: watchlist });
  }),
};