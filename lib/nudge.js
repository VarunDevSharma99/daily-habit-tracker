import { getServiceClient } from './supabase.js';
import { getScoreZone, HABIT_LABELS, HABIT_ORDER } from './scoring.js';
import { selectQuote } from './quotes.js';

// ============================================================
// Nudge Engine — 3 layers of behavior-change messaging
// ============================================================

// Layer 1: Nightly nudge — sent after every check-in
export async function generateNightlyNudge(entry, streaks) {
  const db = getServiceClient();
  const zone = getScoreZone(entry.daily_score);

  // Get last quote ID to avoid repeats
  const { data: botState } = await db.from('bot_state').select('last_quote_id').eq('id', 1).single();
  const lastQuoteId = botState?.last_quote_id || 0;

  // Check for comeback king (20+ point jump from yesterday)
  const yesterday = new Date(entry.date);
  yesterday.setDate(yesterday.getDate() - 1);
  const { data: yesterdayEntry } = await db.from('daily_entries')
    .select('daily_score')
    .eq('date', yesterday.toISOString().split('T')[0])
    .single();

  const isComebackKing = yesterdayEntry && (entry.daily_score - yesterdayEntry.daily_score >= 20);

  // Find weakest habit this week
  const weekAgo = new Date(entry.date);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { data: weekEntries } = await db.from('daily_entries')
    .select('*')
    .gte('date', weekAgo.toISOString().split('T')[0])
    .lte('date', entry.date)
    .order('date', { ascending: false });

  const weakestHabit = findWeakestHabit(weekEntries || []);
  const quote = selectQuote(zone.key, lastQuoteId, { isComebackKing });

  // Update last quote
  await db.from('bot_state').update({ last_quote_id: quote.id }).eq('id', 1);

  // Build message by zone
  let message = '';

  if (isComebackKing) {
    message = `Yesterday ${yesterdayEntry.daily_score}. Today ${entry.daily_score}. ${quote.text}`;
  } else if (entry.daily_score >= 85) {
    const checkinStreak = streaks.find(s => s.streak_type === 'checkin');
    message = `${entry.daily_score}/100. ${checkinStreak?.current_count || 1} days straight. ${quote.text}`;
  } else if (entry.daily_score >= 65) {
    const weakLabel = weakestHabit ? HABIT_LABELS[weakestHabit.habit] : '';
    const weakNote = weakestHabit ? ` But ${weakLabel} missed ${weakestHabit.missCount} of last ${weekEntries?.length || 7} days.` : '';
    message = `${entry.daily_score}/100. Solid.${weakNote} ${quote.text}`;
  } else if (entry.daily_score >= 45) {
    const weakLabel = weakestHabit ? HABIT_LABELS[weakestHabit.habit] : '';
    const weakNote = weakestHabit ? ` ${weakLabel} missed again.` : '';
    message = `${entry.daily_score}/100. Second day below 65.${weakNote} ${quote.text}`;
  } else {
    message = `${entry.daily_score}/100. Red zone. ${quote.text}`;
  }

  return message;
}

// Layer 2: Morning pattern alerts — detect slipping patterns
export async function detectPatterns(todayDateStr) {
  const db = getServiceClient();

  const weekAgo = new Date(todayDateStr);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: entries } = await db.from('daily_entries')
    .select('*')
    .gte('date', weekAgo.toISOString().split('T')[0])
    .lt('date', todayDateStr)
    .order('date', { ascending: false });

  if (!entries || entries.length < 3) return null;

  const alerts = [];

  // 3-day habit drop: any single habit missed/scored 0 for 3 days in a row
  const recentThree = entries.slice(0, 3);
  const booleanHabits = ['work_start', 'shaper_work', 'kids_time', 'meditation', 'gratitude'];

  for (const habit of booleanHabits) {
    const missedAll3 = recentThree.every(e => e[habit] === false);
    if (missedAll3) {
      alerts.push({
        type: '3_day_drop',
        habit,
        missStreak: 3,
        message: `${HABIT_LABELS[habit]}: 0 for 3 days. Today is the day you break the pattern — or it breaks you.`,
      });
    }
  }

  // Exercise: 3 days of 0
  if (recentThree.every(e => e.exercise === 0)) {
    alerts.push({
      type: '3_day_drop',
      habit: 'exercise',
      missStreak: 3,
      message: 'Exercise: 0 for 3 days. Today is the day you break the pattern — or it breaks you.',
    });
  }

  // Shaper drought: 4+ consecutive days
  const recentFour = entries.slice(0, 4);
  if (recentFour.length >= 4 && recentFour.every(e => e.shaper_work === false)) {
    alerts.push({
      type: 'shaper_drought',
      habit: 'shaper_work',
      missStreak: 4,
      message: "4 days without a Shaper block. You're running the present, not building the future. Block 2 hours today.",
    });
  }

  // Kids gap: 3+ in a week
  const kidsMissed = entries.filter(e => e.kids_time === false).length;
  if (kidsMissed >= 3) {
    alerts.push({
      type: 'kids_gap',
      habit: 'kids_time',
      missStreak: kidsMissed,
      message: `You said kids, specifically kids. ${kidsMissed} missed this week. Tonight — phones down, 30 minutes, just them.`,
    });
  }

  // Work start slip: 3+ in a week
  const workMissed = entries.filter(e => e.work_start === false).length;
  if (workMissed >= 3) {
    alerts.push({
      type: 'work_start_slip',
      habit: 'work_start',
      missStreak: workMissed,
      message: `${workMissed} days this week you didn't leave the house by 8. The morning sets the day. Tomorrow: out the door by 7:45.`,
    });
  }

  // Weekly slump: 10+ point drop from previous week
  const twoWeeksAgo = new Date(todayDateStr);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const { data: prevWeekEntries } = await db.from('daily_entries')
    .select('daily_score')
    .gte('date', twoWeeksAgo.toISOString().split('T')[0])
    .lt('date', weekAgo.toISOString().split('T')[0]);

  if (prevWeekEntries && prevWeekEntries.length > 0 && entries.length > 0) {
    const prevAvg = prevWeekEntries.reduce((s, e) => s + e.daily_score, 0) / prevWeekEntries.length;
    const thisAvg = entries.reduce((s, e) => s + e.daily_score, 0) / entries.length;
    if (prevAvg - thisAvg >= 10) {
      alerts.push({
        type: 'weekly_slump',
        habit: null,
        missStreak: 0,
        message: `Last week: ${Math.round(prevAvg)} avg. This week so far: ${Math.round(thisAvg)}. Something changed. What is it?`,
      });
    }
  }

  if (alerts.length === 0) return null;

  // Pick the one with the longest miss streak
  alerts.sort((a, b) => b.missStreak - a.missStreak);
  return alerts[0];
}

// Layer 3 milestone messages
export function getMilestoneMessage(type, count) {
  const labels = {
    checkin: 'check-in',
    sleep: 'sleep', exercise: 'exercise', eating: 'eating',
    work_start: 'work start', shaper: 'Shaper work',
    kids: 'kids time', meditation: 'meditation', gratitude: 'gratitude',
    solid_day: 'Solid Day',
  };
  const label = labels[type] || type;

  if (count === 7) return `7 days. One full week of ${label}. Building the foundation.`;
  if (count === 14) return `14 days of ${label}. Two weeks. This is becoming a pattern — the right kind.`;
  if (count === 30) return `30 days. One full month of ${label}. That's not motivation — that's discipline.`;
  if (count === 60) return `60-day ${label} streak. This is no longer effort. It's who you are.`;
  if (count === 90) return `90 days of ${label}. A full quarter of showing up. Unstoppable.`;
  if (count === 180) return `180-day ${label} streak. Half a year. Most people can't do 2 weeks.`;
  if (count === 365) return `365 days. One full year of ${label}. You are the 1%.`;
  return null;
}

// Helper: find the weakest habit in a set of entries
function findWeakestHabit(entries) {
  if (entries.length === 0) return null;

  const habitMissCounts = {};
  const boolHabits = ['work_start', 'shaper_work', 'kids_time', 'meditation', 'gratitude'];

  for (const habit of boolHabits) {
    habitMissCounts[habit] = entries.filter(e => e[habit] === false).length;
  }
  habitMissCounts['exercise'] = entries.filter(e => e.exercise === 0).length;

  let worst = null;
  let worstCount = 0;
  for (const [habit, count] of Object.entries(habitMissCounts)) {
    if (count > worstCount) {
      worst = habit;
      worstCount = count;
    }
  }

  return worst ? { habit: worst, missCount: worstCount } : null;
}
