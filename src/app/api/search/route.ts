import { NextRequest, NextResponse } from 'next/server';
import { searchSymbol } from '@/lib/yahoo';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json({ results: [] });
    }

    console.log(`Searching for: ${q}, Key present: ${!!process.env.FINNHUB_API_KEY}`);
    const results = await searchSymbol(q);
    console.log(`Search results for ${q}: ${results.length}`);

    // Results are already formatted by the revised searchSymbol function
    const simplified = results;

    return NextResponse.json({ results: simplified });
}
