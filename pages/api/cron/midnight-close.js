import { getServiceClient } from '../../../lib/supabase.js';

// ============================================================
// Cron: 12:01 AM IST — Finalize previous day if missed
// Vercel Cron: 0 18 31 * * * (18:31 UTC = 00:01 IST next day)
// ============================================================

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getServiceClient();

  // Yesterday in IST
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  ist.setDate(ist.getDate() - 1);
  const yesterdayStr = ist.toISOString().split('T')[0];

  // Check if yesterday has an entry
  const { data: existing } = await db.from('daily_entries')
    .select('id')
    .eq('date', yesterdayStr)
    .single();

  if (existing) {
    return res.status(200).json({ message: 'Yesterday already logged.' });
  }

  // No entry = missed day. Log it. Don't break check-in streak here —
  // the streak engine handles that when the next check-in happens.
  // We just reset bot state for the new day.
  await db.from('bot_state').update({
    current_question: 0,
    today_responses: {},
    nudge_sent: false,
    checkin_date: null,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  // Reset checkin streak since day was missed
  const { data: checkinStreak } = await db.from('streaks')
    .select('*')
    .eq('streak_type', 'checkin')
    .single();

  if (checkinStreak && checkinStreak.current_count > 0) {
    await db.from('streaks').update({
      current_count: 0,
      updated_at: new Date().toISOString(),
    }).eq('streak_type', 'checkin');
  }

  res.status(200).json({ message: `Missed day logged: ${yesterdayStr}` });
}
