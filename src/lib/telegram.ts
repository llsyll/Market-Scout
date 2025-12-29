const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8095819424:AAEXatSgbWZeOvdSL9k11yXv3wd63Cx-8CM';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1564787673';

export const sendTelegramMessage = async (message: string) => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error('Telegram credentials missing');
        return;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Telegram API Error:', errorData);
            throw new Error(`Telegram API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to send Telegram message:', error);
        throw error; // Re-throw for upstream handling
    }
};
