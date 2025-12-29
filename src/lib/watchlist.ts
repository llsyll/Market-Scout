import fs from 'fs';
import path from 'path';
import { kv } from '@vercel/kv';

// Persistence Strategy:
// 1. Vercel KV (Redis) - Best for production (requires env vars)
// 2. Global Memory - Good for warm lambdas (resets on cold start)
// 3. /tmp File - Backup for container reuse (resets on new container)
// 4. Local File - Good for local development

const IS_VERCEL = process.env.VERCEL === '1';
const USE_KV = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

// Local dev path or /tmp for Vercel
const DATA_FILE = IS_VERCEL
    ? path.join('/tmp', 'watchlist.json')
    : path.join(process.cwd(), 'data', 'watchlist.json');

// Global cache to persist across function invocations in the same container
declare global {
    var watchlistCache: WatchlistItem[] | undefined;
}

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

const DEFAULT_WATCHLIST: WatchlistItem[] = [
    { symbol: 'AAPL', type: 'stock', indicators: { ma10: true, ma14: false, macd: true, kdj: true } },
    { symbol: 'BTC-USD', type: 'crypto', indicators: { ma10: true, ma14: false, macd: true, kdj: true } },
];

const ensureDataDir = () => {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (e) { console.error("Failed to create dir", e); }
    }
};

export const getWatchlist = async (): Promise<WatchlistItem[]> => {
    // 1. Try KV
    if (USE_KV) {
        try {
            const data = await kv.get<WatchlistItem[]>('watchlist');
            if (data) {
                global.watchlistCache = data; // Sync cache
                return data;
            }
        } catch (e) {
            console.error("KV Read Error:", e);
        }
    }

    // 2. Try Memory Cache
    if (global.watchlistCache) {
        return global.watchlistCache;
    }

    // 3. Try File
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            const list = JSON.parse(data);
            global.watchlistCache = list;
            return list;
        } catch (error) {
            console.error("File Read Error:", error);
        }
    }

    // 4. Default
    global.watchlistCache = DEFAULT_WATCHLIST;
    return DEFAULT_WATCHLIST;
};

export const saveWatchlist = async (list: WatchlistItem[]) => {
    // Update Memory
    global.watchlistCache = list;

    // Update KV
    if (USE_KV) {
        try {
            await kv.set('watchlist', list);
        } catch (e) {
            console.error("KV Write Error:", e);
        }
    }

    // Update File
    ensureDataDir();
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
    } catch (error) {
        console.error("File Write Error:", error);
    }
};

// --- Helper Wrappers (now async) ---

export const addToWatchlist = async (item: WatchlistItem) => {
    const list = await getWatchlist();
    if (!list.find(i => i.symbol === item.symbol)) {
        list.push(item);
        await saveWatchlist(list);
    }
};

export const removeFromWatchlist = async (symbol: string) => {
    let list = await getWatchlist();
    list = list.filter(i => i.symbol !== symbol);
    await saveWatchlist(list);
};

export const updateWatchlistItem = async (symbol: string, indicators: WatchlistItem['indicators']) => {
    const list = await getWatchlist();
    const index = list.findIndex(i => i.symbol === symbol);
    if (index !== -1) {
        list[index].indicators = indicators;
        await saveWatchlist(list);
    }
};

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
