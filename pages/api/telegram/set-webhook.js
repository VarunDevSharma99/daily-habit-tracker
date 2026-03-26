// ============================================================
// One-time setup: Call this endpoint once after deploying to
// register the webhook URL with Telegram.
// Visit: https://your-app.vercel.app/api/telegram/set-webhook
// ============================================================

export default async function handler(req, res) {
  const webhookUrl = `https://${req.headers.host}/api/telegram/webhook`;

  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
      }),
    }
  );

  const result = await response.json();
  res.status(200).json({ webhookUrl, telegram_response: result });
}
