import { getServiceClient } from '../../lib/supabase.js';
import { calculateScore } from '../../lib/scoring.js';
import { updateStreaks } from '../../lib/streaks.js';
import { generateNightlyNudge } from '../../lib/nudge.js';
import { sendMessage } from '../../lib/telegram.js';

// ============================================================
// API: GET /api/entries?range=today|week|month|all&date=YYYY-MM-DD
//      POST /api/entries — manual check-in from web dashboard
// ============================================================

export default async function handler(req, res) {
  const db = getServiceClient();

  if (req.method === 'GET') {
    return handleGet(db, req, res);
  }

  if (req.method === 'POST') {
    return handlePost(db, req, res);
  }

  res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(db, req, res) {
  const { range = 'today', date } = req.query;
  const todayStr = getTodayIST();

  let query = db.from('daily_entries').select('*');

  switch (range) {
    case 'today':
      query = query.eq('date', date || todayStr);
      break;
    case 'week': {
      const weekAgo = new Date(todayStr);
      weekAgo.setDate(weekAgo.getDate() - 6);
      query = query.gte('date', weekAgo.toISOString().split('T')[0]).lte('date', todayStr);
      break;
    }
    case 'month': {
      const monthStart = (date || todayStr).substring(0, 7) + '-01';
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      query = query.gte('date', monthStart).lt('date', monthEnd.toISOString().split('T')[0]);
      break;
    }
    case 'all':
      break;
  }

  const { data, error } = await query.order('date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Also fetch streaks
  const { data: streaks } = await db.from('streaks').select('*');

  res.status(200).json({ entries: data || [], streaks: streaks || [] });
}

async function handlePost(db, req, res) {
  const { date, sleep, exercise, eating, work_start, shaper_work, kids_time, meditation, gratitude } = req.body;

  const todayStr = getTodayIST();
  const yesterdayStr = getYesterdayIST();

  // Only allow today or yesterday (backfill)
  if (date !== todayStr && date !== yesterdayStr) {
    return res.status(400).json({ error: 'Can only log today or backfill yesterday.' });
  }

  // Check if already exists
  const { data: existing } = await db.from('daily_entries')
    .select('id')
    .eq('date', date)
    .single();

  if (existing) {
    return res.status(409).json({ error: 'Already checked in for this date.' });
  }

  const entry = {
    date,
    sleep: parseInt(sleep),
    exercise: parseInt(exercise),
    eating: parseInt(eating),
    work_start: work_start === true || work_start === 'true',
    shaper_work: shaper_work === true || shaper_work === 'true',
    kids_time: kids_time === true || kids_time === 'true',
    meditation: meditation === true || meditation === 'true',
    gratitude: gratitude === true || gratitude === 'true',
    source: 'web',
    checked_in_at: new Date().toISOString(),
    is_skipped: false,
  };

  entry.daily_score = calculateScore(entry);

  const { error } = await db.from('daily_entries').insert(entry);
  if (error) return res.status(500).json({ error: error.message });

  // Update streaks
  await updateStreaks(entry, date);

  res.status(200).json({ entry });
}

function getTodayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split('T')[0];
}

function getYesterdayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  ist.setDate(ist.getDate() - 1);
  return ist.toISOString().split('T')[0];
}
