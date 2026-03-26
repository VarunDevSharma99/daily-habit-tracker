import { getServiceClient } from '../../../lib/supabase.js';
import { sendMessage, QUESTIONS } from '../../../lib/telegram.js';

// ============================================================
// Cron: 9:00 PM IST — Send check-in prompt + Question 1
// Vercel Cron: 0 15 30 * * * (15:30 UTC = 21:00 IST)
// ============================================================

export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getServiceClient();
  const todayStr = getTodayIST();

  // Check if already checked in today
  const { data: existing } = await db.from('daily_entries')
    .select('id')
    .eq('date', todayStr)
    .single();

  if (existing) {
    return res.status(200).json({ message: 'Already checked in today. Skipping prompt.' });
  }

  // Reset bot state and send first question
  await db.from('bot_state').update({
    current_question: 0,
    today_responses: {},
    checkin_date: todayStr,
    nudge_sent: false,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  await sendMessage("🤜 Time to check in. 30 seconds. Let's go.");
  const q = QUESTIONS[0];
  await sendMessage(q.text, q.keyboard);

  res.status(200).json({ message: 'Check-in prompt sent.' });
}

function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split('T')[0];
}
