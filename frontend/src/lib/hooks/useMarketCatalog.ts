'use client';

import { useEffect, useState } from 'react';
import { marketAPI, type CatalogStock, type MarketCatalog } from '@/lib/api';

export type { CatalogStock, MarketCatalog };

let cachedCatalog: MarketCatalog | null = null;
let inflightCatalog: Promise<MarketCatalog> | null = null;

function normalizeValue(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function tokenizeValue(value: string): string[] {
  return value
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

async function loadCatalog(): Promise<MarketCatalog> {
  if (cachedCatalog) return cachedCatalog;
  if (!inflightCatalog) {
    inflightCatalog = marketAPI.getCatalog().then((catalog) => {
      cachedCatalog = catalog;
      return catalog;
    }).finally(() => {
      inflightCatalog = null;
    });
  }

  return inflightCatalog;
}

export function searchCatalogStocks(
  catalog: MarketCatalog | null,
  query: string,
  limit = 10,
): CatalogStock[] {
  if (!catalog) return [];

  const normalizedQuery = normalizeValue(query);
  if (!normalizedQuery) return [];

  const shortQuery = normalizedQuery.length < 4;

  return [...catalog.stocks]
    .map((stock) => {
      const exactSymbol = normalizeValue(stock.symbol) === normalizedQuery;
      const symbolPrefix = normalizeValue(stock.symbol).startsWith(normalizedQuery);
      const aliasPrefix = stock.aliases.some((alias) => normalizeValue(alias).startsWith(normalizedQuery));
      const tokenPrefix = [stock.name, ...stock.aliases].some((value) =>
        tokenizeValue(value).some((token) => token.startsWith(normalizedQuery)),
      );
      const nameContains = !shortQuery && normalizeValue(stock.name).includes(normalizedQuery);

      if (!exactSymbol && !symbolPrefix && !aliasPrefix && !tokenPrefix && !nameContains) {
        return null;
      }

      const score = exactSymbol
        ? 5
        : symbolPrefix
          ? 4
          : aliasPrefix
            ? 3
            : tokenPrefix
              ? 2
              : 1;

      return { score, stock };
    })
    .filter((entry): entry is { score: number; stock: CatalogStock } => Boolean(entry))
    .sort((left, right) => right.score - left.score || Number(right.stock.inNifty50) - Number(left.stock.inNifty50) || left.stock.symbol.localeCompare(right.stock.symbol))
    .slice(0, limit)
    .map(({ stock }) => stock);
}

export function useMarketCatalog() {
  const [catalog, setCatalog] = useState<MarketCatalog | null>(cachedCatalog);
  const [loading, setLoading] = useState(!cachedCatalog);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (cachedCatalog) {
      setCatalog(cachedCatalog);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    loadCatalog()
      .then((nextCatalog) => {
        if (!mounted) return;
        setCatalog(nextCatalog);
        setError(null);
      })
      .catch((nextError) => {
        if (!mounted) return;
        setError((nextError as Error).message || 'Failed to load market catalog.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { catalog, loading, error };
}