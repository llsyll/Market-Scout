import { NextResponse, NextRequest } from 'next/server';
import { getWatchlist } from '@/lib/watchlist';
import { fetchMixedCandles } from '@/lib/data-provider';
import { analyzeIndicators } from '@/lib/indicators';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(req: NextRequest) {
    const watchlist = await getWatchlist();
    const results = [];
    let messagesSent = 0;

    if (watchlist.length === 0) {
        return NextResponse.json({ message: 'Watchlist empty', messagesSent: 0 });
    }

    for (const item of watchlist) {
        try {
            const candles = await fetchMixedCandles(item.symbol, item.type);
            if (!candles || candles.length < 30) {
                results.push({ symbol: item.symbol, status: 'Insufficient data' });
                continue;
            }

            const analysis = analyzeIndicators(item.symbol, candles);

            // Check conditions
            const matches: string[] = [];

            if (item.indicators.ma10 && analysis.signals.ma10Break) {
                matches.push('MA10 突破');
            }
            if (item.indicators.ma14 && analysis.signals.ma14Break) {
                matches.push('MA14 突破');
            }
            if (item.indicators.macd && analysis.signals.macdGoldCrossNodeZero) {
                matches.push('MACD 低位金叉');
            }
            if (item.indicators.kdj && analysis.signals.kdjGoldCrossLow) {
                matches.push('KDJ 低位金叉');
            }

            let shouldNotify = false;
            const selectedIndicators = [];
            if (item.indicators.ma10) selectedIndicators.push('ma10');
            if (item.indicators.ma14) selectedIndicators.push('ma14');
            if (item.indicators.macd) selectedIndicators.push('macd');
            if (item.indicators.kdj) selectedIndicators.push('kdj');

            // Logic: Notify if ALL selected indicators are met
            if (selectedIndicators.length > 0) {
                const ma10Ok = !item.indicators.ma10 || analysis.signals.ma10Break;
                const ma14Ok = !item.indicators.ma14 || analysis.signals.ma14Break;
                const macdOk = !item.indicators.macd || analysis.signals.macdGoldCrossNodeZero;
                const kdjOk = !item.indicators.kdj || analysis.signals.kdjGoldCrossLow;

                if (ma10Ok && ma14Ok && macdOk && kdjOk) {
                    shouldNotify = true;
                }
            }

            if (shouldNotify) {
                const msg = `🚀 *机会预警: ${item.symbol}*
价格: ${analysis.price.toFixed(2)}
触发指标:
${matches.map(m => `- ${m}`).join('\n')}

详细数据:
MA10: ${analysis.details.ma10?.toFixed(2)}
MA14: ${analysis.details.ma14?.toFixed(2)}
MACD: ${analysis.details.macd?.macd.toFixed(2)}
KDJ: K=${analysis.details.kdj?.k.toFixed(1)} D=${analysis.details.kdj?.d.toFixed(1)}
`;
                await sendTelegramMessage(msg);
                messagesSent++;
            }

            results.push({ symbol: item.symbol, match: shouldNotify, details: analysis.signals });

        } catch (error) {
            console.error(`Check failed for ${item.symbol}`, error);
            results.push({ symbol: item.symbol, error: 'Check failed' });
        }
    }

    return NextResponse.json({ results, messagesSent });
}
