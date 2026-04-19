import mongoose, { Document, Schema } from 'mongoose';

export interface IFinancialQuarter extends Document {
  symbol: string;
  period: string;
  year: number;
  quarter: number;
  revenue: number;
  netIncome: number;
  eps: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  cashFromOperations: number;
  cashFromInvesting: number;
  cashFromFinancing: number;
  source: 'NSE' | 'BSE';
  filingDate: string;
  lastUpdated: Date;
}

const financialSchema = new Schema<IFinancialQuarter>(
  {
    symbol: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    period: {
      type: String,
      required: true,
      enum: ['Q1', 'Q2', 'Q3', 'Q4', 'FY'],
    },
    year: {
      type: Number,
      required: true,
    },
    quarter: {
      type: Number,
      required: true,
    },
    revenue: {
      type: Number,
      default: 0,
    },
    netIncome: {
      type: Number,
      default: 0,
    },
    eps: {
      type: Number,
      default: 0,
    },
    totalAssets: {
      type: Number,
      default: 0,
    },
    totalLiabilities: {
      type: Number,
      default: 0,
    },
    totalEquity: {
      type: Number,
      default: 0,
    },
    cashFromOperations: {
      type: Number,
      default: 0,
    },
    cashFromInvesting: {
      type: Number,
      default: 0,
    },
    cashFromFinancing: {
      type: Number,
      default: 0,
    },
    source: {
      type: String,
      enum: ['NSE', 'BSE'],
      default: 'NSE',
    },
    filingDate: {
      type: String,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

financialSchema.index({ symbol: 1, year: 1, quarter: 1 }, { unique: true });

export const Financial = mongoose.model<IFinancialQuarter>('Financial', financialSchema);