import { getServiceClient } from '../../../lib/supabase.js';
import { getScoreZone, HABIT_LABELS, HABIT_ORDER } from '../../../lib/scoring.js';
import { sendMessage } from '../../../lib/telegram.js';

// ============================================================
// Cron: Sunday 10:00 AM IST — Weekly summary
// Vercel Cron: 0 4 30 * * 0 (04:30 UTC Sunday = 10:00 IST Sunday)
// ============================================================

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getServiceClient();

  // Get this week's entries (Monday to Sunday)
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const todayStr = ist.toISOString().split('T')[0];

  const weekAgo = new Date(ist);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  const { data: entries } = await db.from('daily_entries')
    .select('*')
    .gte('date', weekAgoStr)
    .lte('date', todayStr)
    .order('date', { ascending: true });

  if (!entries || entries.length === 0) {
    await sendMessage('📊 <b>Weekly Summary</b>\n\nNo check-ins this week. Let\'s change that.');
    return res.status(200).json({ message: 'Empty week summary sent.' });
  }

  const avg = Math.round(entries.reduce((s, e) => s + e.daily_score, 0) / entries.length);
  const zone = getScoreZone(avg);
  const best = entries.reduce((max, e) => e.daily_score > max.daily_score ? e : max);
  const worst = entries.reduce((min, e) => e.daily_score < min.daily_score ? e : min);

  // Per-habit stats
  const habitStats = HABIT_ORDER.map(h => {
    let hitDays;
    if (h === 'exercise') {
      hitDays = entries.filter(e => e[h] > 0).length;
    } else if (['work_start', 'shaper_work', 'kids_time', 'meditation', 'gratitude'].includes(h)) {
      hitDays = entries.filter(e => e[h] === true).length;
    } else {
      hitDays = entries.length; // sleep/eating always scored
    }
    return { habit: h, hitDays, total: entries.length, pct: Math.round((hitDays / entries.length) * 100) };
  });

  // Get previous week for comparison
  const prevWeekEnd = new Date(weekAgo);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  const prevWeekStart = new Date(prevWeekEnd);
  prevWeekStart.setDate(prevWeekStart.getDate() - 6);

  const { data: prevEntries } = await db.from('daily_entries')
    .select('daily_score')
    .gte('date', prevWeekStart.toISOString().split('T')[0])
    .lte('date', prevWeekEnd.toISOString().split('T')[0]);

  let comparison = '';
  if (prevEntries && prevEntries.length > 0) {
    const prevAvg = Math.round(prevEntries.reduce((s, e) => s + e.daily_score, 0) / prevEntries.length);
    const delta = avg - prevAvg;
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
    comparison = `\nVs last week: ${arrow} ${Math.abs(delta)} points (was ${prevAvg})`;
  }

  // Streaks
  const { data: streaks } = await db.from('streaks').select('*');
  const checkinStreak = streaks?.find(s => s.streak_type === 'checkin');

  let msg = `📊 <b>Weekly Summary</b>\n\n`;
  msg += `Average: <b>${avg}/100 — ${zone.label}</b>\n`;
  msg += `Days checked in: ${entries.length}/7\n`;
  msg += `Best day: ${best.daily_score} (${best.date})\n`;
  msg += `Worst day: ${worst.daily_score} (${worst.date})`;
  msg += comparison;
  msg += `\n\n<b>Habits</b>\n`;

  for (const stat of habitStats) {
    const bar = stat.pct >= 80 ? '🟢' : stat.pct >= 50 ? '🟡' : '🔴';
    msg += `${bar} ${HABIT_LABELS[stat.habit]}: ${stat.hitDays}/${stat.total} (${stat.pct}%)\n`;
  }

  if (checkinStreak) {
    msg += `\n🔥 Check-in streak: ${checkinStreak.current_count} days`;
  }

  await sendMessage(msg);
  res.status(200).json({ message: 'Weekly summary sent.' });
}
