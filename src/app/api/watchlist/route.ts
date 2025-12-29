import { NextRequest, NextResponse } from 'next/server';
import { getWatchlist, addToWatchlist, removeFromWatchlist, WatchlistItem } from '@/lib/watchlist';
import { getQuotes } from '@/lib/yahoo';

export async function GET() {
    const watchlist = getWatchlist();
    const symbols = watchlist.map(item => item.symbol);

    if (symbols.length === 0) {
        return NextResponse.json(watchlist);
    }

    const quotes = await getQuotes(symbols);

    // Merge quote data into watchlist items
    const enrichedWatchlist = watchlist.map(item => {
        const quote = quotes.find(q => q.symbol === item.symbol);
        return {
            ...item,
            data: quote ? {
                price: quote.regularMarketPrice,
                change: quote.regularMarketChange,
                changePercent: quote.regularMarketChangePercent,
                name: quote.shortName
            } : undefined
        };
    });

    return NextResponse.json(enrichedWatchlist);
}

export async function POST(request: NextRequest) {
    try {
        const body: WatchlistItem = await request.json();
        if (!body.symbol || !body.type) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }
        // Set defaults for indicators if missing
        const newItem: WatchlistItem = {
            ...body,
            indicators: body.indicators || { ma10: false, ma14: false, macd: false, kdj: false }
        };
        // Ensure ma14 is present if it was a partial update or legacy data
        if (newItem.indicators.ma14 === undefined) newItem.indicators.ma14 = false;

        addToWatchlist(newItem);
        return NextResponse.json({ success: true, watchlist: getWatchlist() });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add item' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
    }

    removeFromWatchlist(symbol);
    return NextResponse.json({ success: true, watchlist: getWatchlist() });
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { symbol, indicators } = body;

        if (!symbol || !indicators) {
            return NextResponse.json({ error: 'Symbol and indicators required' }, { status: 400 });
        }

        const { updateWatchlistItem } = require('@/lib/watchlist');
        updateWatchlistItem(symbol, indicators);

        return NextResponse.json({ success: true, watchlist: getWatchlist() });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }
}
