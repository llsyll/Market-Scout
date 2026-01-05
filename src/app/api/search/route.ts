import { NextRequest, NextResponse } from 'next/server';
import { searchSymbol } from '@/lib/yahoo';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
        return NextResponse.json({ results: [] });
    }

    const results = await searchSymbol(q);

    // Results are already formatted by the revised searchSymbol function
    const simplified = results;

    return NextResponse.json({ results: simplified });
}
