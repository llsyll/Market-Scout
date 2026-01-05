import { NextRequest, NextResponse } from 'next/server';
import { searchSymbol } from '@/lib/yahoo';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json({ results: [] });
    }

    const results = await searchSymbol(q);

    // Simplify results for frontend
    const simplified = results.map((item: any) => ({
        symbol: item.symbol,
        shortname: item.shortname || item.longname || item.symbol,
        quoteType: item.quoteType,
        exchange: item.exchange,
    }));

    return NextResponse.json({ results: simplified });
}
