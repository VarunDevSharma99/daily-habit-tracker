import { getServiceClient } from '../../../lib/supabase.js';
import { getScoreZone, HABIT_LABELS, HABIT_ORDER } from '../../../lib/scoring.js';
import { sendMessage } from '../../../lib/telegram.js';

// ============================================================
// Cron: 1st of month 10:00 AM IST — Monthly report
// Vercel Cron: 0 4 30 1 * * (04:30 UTC on 1st = 10:00 IST on 1st)
// ============================================================

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getServiceClient();

  // Previous month
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const thisMonth = ist.getMonth(); // 0-indexed
  const thisYear = ist.getFullYear();

  const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const prevYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const startDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
  const endDate = `${thisYear}-${String(thisMonth + 1).padStart(2, '0')}-01`;

  const { data: entries } = await db.from('daily_entries')
    .select('*')
    .gte('date', startDate)
    .lt('date', endDate)
    .order('date', { ascending: true });

  if (!entries || entries.length === 0) {
    await sendMessage('📅 <b>Monthly Report</b>\n\nNo check-ins last month.');
    return res.status(200).json({ message: 'Empty month.' });
  }

  const avg = Math.round(entries.reduce((s, e) => s + e.daily_score, 0) / entries.length);
  const zone = getScoreZone(avg);
  const daysInMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

  // Best and worst weeks (group by week)
  const weeks = [];
  for (let i = 0; i < entries.length; i += 7) {
    const weekSlice = entries.slice(i, i + 7);
    const weekAvg = Math.round(weekSlice.reduce((s, e) => s + e.daily_score, 0) / weekSlice.length);
    weeks.push({ start: weekSlice[0].date, avg: weekAvg });
  }
  const bestWeek = weeks.reduce((best, w) => w.avg > best.avg ? w : best, weeks[0]);
  const worstWeek = weeks.reduce((worst, w) => w.avg < worst.avg ? w : worst, weeks[0]);

  // Most consistent and most skipped habit
  const habitHits = {};
  for (const h of HABIT_ORDER) {
    if (h === 'exercise') {
      habitHits[h] = entries.filter(e => e[h] > 0).length;
    } else if (['work_start', 'shaper_work', 'kids_time', 'meditation', 'gratitude'].includes(h)) {
      habitHits[h] = entries.filter(e => e[h] === true).length;
    } else {
      habitHits[h] = entries.length;
    }
  }

  const sortedHabits = Object.entries(habitHits).sort((a, b) => b[1] - a[1]);
  const mostConsistent = sortedHabits[0];
  const mostSkipped = sortedHabits[sortedHabits.length - 1];

  // Longest streak that month
  const { data: streaks } = await db.from('streaks').select('*');
  const longestStreak = streaks?.reduce((best, s) => s.best_count > best.best_count ? s : best, streaks[0]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  let msg = `📅 <b>${monthNames[prevMonth]} ${prevYear} — Monthly Report</b>\n\n`;
  msg += `Average Score: <b>${avg}/100 — ${zone.label}</b>\n`;
  msg += `Days Checked In: ${entries.length}/${daysInMonth}\n`;
  msg += `Check-in Rate: ${Math.round((entries.length / daysInMonth) * 100)}%\n\n`;
  msg += `Best Week: ${bestWeek.avg} avg (starting ${bestWeek.start})\n`;
  msg += `Worst Week: ${worstWeek.avg} avg (starting ${worstWeek.start})\n\n`;
  msg += `Most Consistent: ${HABIT_LABELS[mostConsistent[0]]} (${mostConsistent[1]}/${entries.length} days)\n`;
  msg += `Most Skipped: ${HABIT_LABELS[mostSkipped[0]]} (${mostSkipped[1]}/${entries.length} days)\n`;

  if (longestStreak) {
    const streakLabels = {
      checkin: 'Check-in', sleep: 'Sleep', exercise: 'Exercise', eating: 'Eating',
      work_start: 'Work Start', shaper: 'Shaper', kids: 'Kids', meditation: 'Meditation',
      gratitude: 'Gratitude', solid_day: 'Solid Day',
    };
    msg += `\nLongest Streak: ${streakLabels[longestStreak.streak_type]} — ${longestStreak.best_count} days`;
  }

  await sendMessage(msg);
  res.status(200).json({ message: 'Monthly report sent.' });
}
