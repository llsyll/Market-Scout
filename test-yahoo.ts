
import YahooFinance from 'yahoo-finance2';

// Set User Agent
// @ts-ignore
// YahooFinance.suppressNotices(['yahooSurvey', 'ripHistorical']);

const yahooFinance = new YahooFinance();

async function test() {
    console.log("--- Testing Search 'NVDA' ---");
    try {
        const searchRes = await yahooFinance.search('NVDA');
        console.log("Search Result Count:", searchRes.quotes.length);
    } catch (e) { console.log("Yahoo Search Failed:", e.message || e); }

    console.log("\n--- Testing Quote 'BTC-USD' ---");
    try {
        const quoteRes = await yahooFinance.quote('BTC-USD');
        console.log("Yahoo Quote Result:", JSON.stringify(quoteRes, null, 2));
    } catch (e) { console.log("Yahoo BTC Quote Failed:", e.message || e); }

    console.log("\n--- Testing Binance.com 'BTCUSDT' ---");
    try {
        const binanceRes = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
        if (binanceRes.ok) {
            const data = await binanceRes.json();
            console.log("Binance.com Result:", data.lastPrice);
        } else {
            console.log("Binance.com Failed:", binanceRes.status);
        }
    } catch (e) { console.log("Binance.com Error:", e); }

    console.log("\n--- Testing Binance Vision 'BTCUSDT' ---");
    try {
        const binanceVision = await fetch("https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT");
        if (binanceVision.ok) {
            const data = await binanceVision.json();
            console.log("Binance Vision Result:", data.lastPrice);
        } else {
            console.log("Binance Vision Failed:", binanceVision.status);
        }
    } catch (e) { console.log("Binance Vision Error:", e); }

    console.log("\n--- Testing Binance US 'BTCUSD' ---");
    try {
        const binanceUS = await fetch("https://api.binance.us/api/v3/ticker/24hr?symbol=BTCUSD");
        if (binanceUS.ok) {
            const data = await binanceUS.json();
            console.log("Binance US Result:", data.lastPrice);
        } else {
            console.log("Binance US Failed:", binanceUS.status);
        }
    } catch (e) { console.log("Binance US Error:", e); }

    console.log("\n--- Testing CoinGecko 'bitcoin' ---");
    try {
        const cg = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
        if (cg.ok) {
            const data = await cg.json();
            console.log("CoinGecko Result:", data);
        } else {
            console.log("CoinGecko Failed:", cg.status);
        }
    } catch (e) { console.log("CoinGecko Error:", e); }
}

test();
