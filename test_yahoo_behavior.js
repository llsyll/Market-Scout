const { getQuotes } = require('./src/lib/yahoo');

async function test() {
    console.log("Testing with valid symbol...");
    const valid = await getQuotes(['AAPL']);
    console.log("Valid result:", JSON.stringify(valid, null, 2));

    console.log("\nTesting with invalid symbol...");
    const invalid = await getQuotes(['TESLA']);
    console.log("Invalid result:", JSON.stringify(invalid, null, 2));

    console.log("\nTesting with mixed...");
    const mixed = await getQuotes(['AAPL', 'TESLA']);
    console.log("Mixed result:", JSON.stringify(mixed, null, 2));
}

// Mocking the TS import for JS execution in Node if needed, 
// but since it's a TS project, I might can't run this directly with `node`.
// I'll rely on `ts-node` if available or just create a route to test it.

// Actually, let's just make a temporary API route to test this, it's easier in this env.
