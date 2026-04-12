import mongoose, { Document, Schema } from 'mongoose';

export interface IHolding {
  _id?: mongoose.Types.ObjectId;
  symbol: string;
  name?: string;
  qty: number;
  avgPrice: number;
  currentPrice?: number;
  sector?: string;
  exchange?: string;
}

export interface IPortfolio extends Document {
  user: Schema.Types.ObjectId;
  name: string;
  holdings: IHolding[];
}

const holdingSchema = new Schema<IHolding>(
  {
    symbol: {
      type: String,
      required: true,
      trim: true,
    },
    name: String,
    qty: {
      type: Number,
      required: true,
      min: 0,
    },
    avgPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currentPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    sector: {
      type: String,
      default: 'Other',
    },
    exchange: {
      type: String,
      default: 'NSE',
    },
  },
  { _id: true }
);

const portfolioSchema = new Schema<IPortfolio>(
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
      default: 'My Portfolio',
      trim: true,
    },
    holdings: [holdingSchema],
  },
  {
    timestamps: true,
  }
);

portfolioSchema.index({ user: 1, name: 1 }, { unique: true });

export const Portfolio = mongoose.model<IPortfolio>('Portfolio', portfolioSchema);