import { sendMessage } from '../../../lib/telegram.js';
import { detectPatterns } from '../../../lib/nudge.js';

// ============================================================
// Cron: 7:30 AM IST — Morning pattern alerts (Layer 2)
// Vercel Cron: 0 2 0 * * * (02:00 UTC = 07:30 IST)
// ============================================================

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Today in IST
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const todayStr = ist.toISOString().split('T')[0];

  const alert = await detectPatterns(todayStr);

  if (alert) {
    await sendMessage(alert.message);
    return res.status(200).json({ message: 'Pattern alert sent.', alert: alert.type });
  }

  res.status(200).json({ message: 'No patterns detected.' });
}
