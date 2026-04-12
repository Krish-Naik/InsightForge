import mongoose, { Document, Schema } from 'mongoose';

export interface IStock {
  symbol: string;
  name?: string;
  exchange: string;
}

export interface IWatchlist extends Document {
  user: Schema.Types.ObjectId;
  name: string;
  stocks: IStock[];
}

const stockSchema = new Schema<IStock>(
  {
    symbol: {
      type: String,
      required: true,
      trim: true,
    },
    name: String,
    exchange: {
      type: String,
      default: 'NSE',
    },
  },
  { _id: true }
);

const watchlistSchema = new Schema<IWatchlist>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      default: 'My Watchlist',
      trim: true,
    },
    stocks: [stockSchema],
  },
  {
    timestamps: true,
  }
);

watchlistSchema.index({ user: 1, name: 1 }, { unique: true });

export const Watchlist = mongoose.model<IWatchlist>('Watchlist', watchlistSchema);