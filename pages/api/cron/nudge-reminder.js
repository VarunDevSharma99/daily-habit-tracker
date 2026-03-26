import { getServiceClient } from '../../../lib/supabase.js';
import { sendMessage } from '../../../lib/telegram.js';

// ============================================================
// Cron: 9:30 PM IST — Single nudge if check-in not completed
// Vercel Cron: 0 16 0 * * * (16:00 UTC = 21:30 IST)
// ============================================================

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getServiceClient();
  const todayStr = getTodayIST();

  // Check if already checked in
  const { data: existing } = await db.from('daily_entries')
    .select('id')
    .eq('date', todayStr)
    .single();

  if (existing) {
    return res.status(200).json({ message: 'Already checked in. No nudge needed.' });
  }

  // Check if nudge already sent
  const { data: botState } = await db.from('bot_state')
    .select('nudge_sent')
    .eq('id', 1)
    .single();

  if (botState?.nudge_sent) {
    return res.status(200).json({ message: 'Nudge already sent.' });
  }

  await sendMessage("30 seconds. That's all.");

  await db.from('bot_state').update({
    nudge_sent: true,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  res.status(200).json({ message: 'Nudge sent.' });
}

function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split('T')[0];
}
