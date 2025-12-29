import fs from 'fs';
import path from 'path';

// Note: In Vercel serverless functions, the filesystem is not persistent.
// However, for local dev and build time, this works.
// We will use a simple JSON file for now.

const DATA_FILE = path.join(process.cwd(), 'data', 'watchlist.json');

// Ensure data directory exists
const ensureDataDir = () => {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

export interface WatchlistItem {
    symbol: string;
    type: 'stock' | 'crypto';
    indicators: {
        ma10: boolean;
        ma14: boolean;
        macd: boolean;
        kdj: boolean;
    };
}

// Initial default data
const DEFAULT_WATCHLIST: WatchlistItem[] = [
    { symbol: 'AAPL', type: 'stock', indicators: { ma10: true, ma14: false, macd: true, kdj: true } },
    { symbol: 'BTC-USD', type: 'crypto', indicators: { ma10: true, ma14: false, macd: true, kdj: true } },
];

export const getWatchlist = (): WatchlistItem[] => {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error("Error reading watchlist:", error);
            return DEFAULT_WATCHLIST;
        }
    }
    // Initialize with default if not active
    return DEFAULT_WATCHLIST;
};

export const saveWatchlist = (list: WatchlistItem[]) => {
    ensureDataDir();
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
    } catch (error) {
        console.error("Error writing watchlist:", error);
    }
};

export const addToWatchlist = (item: WatchlistItem) => {
    const list = getWatchlist();
    if (!list.find(i => i.symbol === item.symbol)) {
        list.push(item);
        saveWatchlist(list);
    }
};

export const removeFromWatchlist = (symbol: string) => {
    let list = getWatchlist();
    list = list.filter(i => i.symbol !== symbol);
    saveWatchlist(list);
};

export const updateWatchlistItem = (symbol: string, indicators: WatchlistItem['indicators']) => {
    const list = getWatchlist();
    const index = list.findIndex(i => i.symbol === symbol);
    if (index !== -1) {
        list[index].indicators = indicators;
        saveWatchlist(list);
    }
};
