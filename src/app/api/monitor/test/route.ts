import { NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST() {
    try {
        await sendTelegramMessage("👋 This is a test message from your Stock/Crypto Monitor!");
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to send' }, { status: 500 });
    }
}
