import { FMPService } from './fmpService.js';

interface Stock {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: number;
  price: number;
}

interface PeerStock extends Stock {
  changePercent: number;
  pe: number;
  volume: number;
}

export class PeersService {
  /**
   * Get peer stocks based on sector and market cap similarity
   */
  static async getPeers(symbol: string, allStocks: Stock[]): Promise<PeerStock[]> {
    try {
      const targetQuote = await FMPService.getQuote(symbol);
      if (!targetQuote) return [];

      // Find the target stock in the catalog
      const targetStock = allStocks.find(s => s.symbol === symbol);
      if (!targetStock) return [];

      const targetMarketCap = targetQuote.marketCap;
      const targetSector = targetStock.sector;

      // Filter peers by same sector and similar market cap (within 50% range)
      const potentialPeers = allStocks.filter(stock => {
        if (stock.symbol === symbol) return false;
        if (stock.sector !== targetSector) return false;
        
        const marketCapDiff = Math.abs(stock.marketCap - targetMarketCap);
        const marketCapThreshold = targetMarketCap * 0.5;
        
        return marketCapDiff <= marketCapThreshold;
      });

      // Fetch quotes for top 10 potential peers
      const peerPromises = potentialPeers.slice(0, 10).map(async (peer) => {
        const quote = await FMPService.getQuote(peer.symbol);
        if (!quote) return null;

        return {
          ...peer,
          price: quote.price,
          changePercent: quote.changesPercentage,
          pe: quote.pe,
          volume: quote.volume,
        };
      });

      const peerResults = await Promise.all(peerPromises);
      const validPeers = peerResults.filter((p): p is PeerStock => p !== null);

      // Sort by market cap descending
      return validPeers.sort((a, b) => b.marketCap - a.marketCap);
    } catch (error) {
      console.error('Error fetching peers:', error);
      return [];
    }
  }

  /**
   * Calculate sector metrics based on peer performance
   */
  static calculateSectorMetrics(peers: PeerStock[]) {
    if (peers.length === 0) {
      return {
        averageChange: 0,
        positiveCount: 0,
        negativeCount: 0,
        breadth: 0,
        averagePE: 0,
        totalVolume: 0,
      };
    }

    const positiveCount = peers.filter(p => p.changePercent > 0).length;
    const negativeCount = peers.filter(p => p.changePercent < 0).length;
    const averageChange = peers.reduce((sum, p) => sum + p.changePercent, 0) / peers.length;
    const breadth = (positiveCount / peers.length) * 100;
    const validPEs = peers.filter(p => p.pe > 0 && p.pe < 100);
    const averagePE = validPEs.length > 0 
      ? validPEs.reduce((sum, p) => sum + p.pe, 0) / validPEs.length 
      : 0;
    const totalVolume = peers.reduce((sum, p) => sum + p.volume, 0);

    return {
      averageChange,
      positiveCount,
      negativeCount,
      breadth,
      averagePE,
      totalVolume,
    };
  }
}