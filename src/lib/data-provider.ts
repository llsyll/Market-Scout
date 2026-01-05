import { fetchStockData, getQuotes, Candle, QuoteData } from './yahoo';

// --- Unified Provider ---

export const fetchMixedCandles = async (symbol: string, type: 'stock' | 'crypto'): Promise<Candle[]> => {
    // Yahoo Finance handles both stocks (AAPL) and crypto (BTC-USD) seamlessly
    // Ensure crypto symbols are in Yahoo format (e.g. BTC-USD)
    let querySymbol = symbol;
    if (type === 'crypto' && !symbol.includes('-')) {
        // Simple heuristic: if it looks like a raw coin name, append -USD
        querySymbol = `${symbol}-USD`;
    }

    return await fetchStockData(querySymbol);
};

export const fetchMixedQuote = async (symbol: string, type: 'stock' | 'crypto'): Promise<QuoteData | null> => {
    let querySymbol = symbol;
    if (type === 'crypto' && !symbol.includes('-')) {
        querySymbol = `${symbol}-USD`;
    }

    try {
        const quotes = await getQuotes([querySymbol]);
        if (quotes && quotes.length > 0) {
            return quotes[0];
        }
        return null;
    } catch (error) {
        console.error(`Error fetching quote for ${symbol}:`, error);
        return null;
    }
};
