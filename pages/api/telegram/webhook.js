import { getServiceClient } from '../../../lib/supabase.js';
import { calculateScore, getScoreZone, HABIT_LABELS } from '../../../lib/scoring.js';
import { updateStreaks } from '../../../lib/streaks.js';
import { generateNightlyNudge, getMilestoneMessage } from '../../../lib/nudge.js';
import { sendMessage, answerCallbackQuery, isAuthorized, QUESTIONS } from '../../../lib/telegram.js';

// ============================================================
// Telegram Webhook — handles all incoming messages & callbacks
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const update = req.body;
    const db = getServiceClient();

    // Handle callback queries (inline keyboard button taps)
    if (update.callback_query) {
      await handleCallback(db, update.callback_query);
      return res.status(200).json({ ok: true });
    }

    // Handle text commands
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      if (!isAuthorized(chatId)) return res.status(200).json({ ok: true });

      const text = update.message.text.trim();
      await handleCommand(db, text);
      return res.status(200).json({ ok: true });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ ok: true }); // Always 200 to avoid Telegram retries
  }
}

// ============================================================
// Command handlers
// ============================================================

async function handleCommand(db, text) {
  switch (text) {
    case '/start':
      await sendMessage("🤜 Let's track your life score. Use /checkin to start your daily check-in.");
      break;

    case '/checkin':
      await startCheckin(db);
      break;

    case '/today':
      await showToday(db);
      break;

    case '/week':
      await showWeek(db);
      break;

    case '/streak':
      await showStreaks(db);
      break;

    case '/skip':
      await skipDay(db);
      break;

    default:
      // Ignore unrecognized messages
      break;
  }
}

// ============================================================
// /checkin — Start the 8-question flow
// ============================================================

async function startCheckin(db) {
  const todayStr = getTodayIST();

  // Check if already checked in today
  const { data: existing } = await db.from('daily_entries')
    .select('daily_score')
    .eq('date', todayStr)
    .single();

  if (existing) {
    const zone = getScoreZone(existing.daily_score);
    await sendMessage(`Already checked in today. Score: ${existing.daily_score}/100 — ${zone.label}.`);
    return;
  }

  // Reset bot state for new check-in
  await db.from('bot_state').update({
    current_question: 0,
    today_responses: {},
    checkin_date: todayStr,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  // Send first question
  const q = QUESTIONS[0];
  await sendMessage(q.text, q.keyboard);
}

// ============================================================
// Callback handler — processes each button tap
// ============================================================

async function handleCallback(db, callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  if (!isAuthorized(chatId)) return;

  await answerCallbackQuery(callbackQuery.id);

  const data = callbackQuery.data; // e.g., "sleep_3" or "work_start_true"
  const [field, rawValue] = data.split(/_(.+)/); // Split on first underscore only

  // Parse value
  let value;
  if (rawValue === 'true') value = true;
  else if (rawValue === 'false') value = false;
  else value = parseInt(rawValue, 10);

  // Get current bot state
  const { data: botState } = await db.from('bot_state')
    .select('*')
    .eq('id', 1)
    .single();

  // Validate we're in an active check-in
  const todayStr = getTodayIST();
  if (botState.checkin_date !== todayStr && botState.current_question === 0) {
    await sendMessage("No active check-in. Use /checkin to start.");
    return;
  }

  // Store this response
  const responses = { ...botState.today_responses, [field]: value };
  const nextQuestion = botState.current_question + 1;

  await db.from('bot_state').update({
    current_question: nextQuestion,
    today_responses: responses,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  if (nextQuestion < 8) {
    // Send next question
    const q = QUESTIONS[nextQuestion];
    await sendMessage(q.text, q.keyboard);
  } else {
    // All 8 answered — calculate score and save
    await finalizeCheckin(db, responses, todayStr);
  }
}

// ============================================================
// Finalize check-in — save entry, update streaks, send nudge
// ============================================================

async function finalizeCheckin(db, responses, dateStr) {
  const entry = {
    date: dateStr,
    sleep: responses.sleep,
    exercise: responses.exercise,
    eating: responses.eating,
    work_start: responses.work_start,
    shaper_work: responses.shaper_work,
    kids_time: responses.kids_time,
    meditation: responses.meditation,
    gratitude: responses.gratitude,
    source: 'telegram',
    checked_in_at: new Date().toISOString(),
    is_skipped: false,
  };

  entry.daily_score = calculateScore(entry);
  const zone = getScoreZone(entry.daily_score);

  // Upsert entry (handles edge case of re-check-in)
  await db.from('daily_entries').upsert(entry, { onConflict: 'date' });

  // Update streaks
  const { milestones } = await updateStreaks(entry, dateStr);

  // Reset bot state
  await db.from('bot_state').update({
    current_question: 0,
    today_responses: {},
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  // Send score summary
  const scoreMsg = `<b>${entry.daily_score}/100 — ${zone.label}</b>\n\n` +
    `😴 Sleep: ${getSleepLabel(entry.sleep)}\n` +
    `💪 Exercise: ${getExerciseLabel(entry.exercise)}\n` +
    `🥗 Eating: ${getEatingLabel(entry.eating)}\n` +
    `🏢 Work by 8AM: ${entry.work_start ? '✅' : '❌'}\n` +
    `🔨 Shaper Work: ${entry.shaper_work ? '✅' : '❌'}\n` +
    `👨‍👧‍👦 Kids Time: ${entry.kids_time ? '✅' : '❌'}\n` +
    `🧘 Meditation: ${entry.meditation ? '✅' : '❌'}\n` +
    `🙏 Gratitude: ${entry.gratitude ? '✅' : '❌'}`;

  await sendMessage(scoreMsg);

  // Send nightly nudge (Layer 1)
  const { data: streaks } = await db.from('streaks').select('*');
  const nudgeMsg = await generateNightlyNudge(entry, streaks);
  if (nudgeMsg) {
    await sendMessage(nudgeMsg);
  }

  // Send any milestone messages (Layer 3)
  for (const milestone of milestones) {
    const msg = getMilestoneMessage(milestone.type, milestone.count);
    if (msg) await sendMessage(`🔥 ${msg}`);
  }
}

// ============================================================
// /today — Show today's score
// ============================================================

async function showToday(db) {
  const todayStr = getTodayIST();
  const { data: entry } = await db.from('daily_entries')
    .select('*')
    .eq('date', todayStr)
    .single();

  if (!entry) {
    await sendMessage("Haven't checked in today. Use /checkin — 30 seconds.");
    return;
  }

  const zone = getScoreZone(entry.daily_score);
  await sendMessage(`Today: <b>${entry.daily_score}/100 — ${zone.label}</b>`);
}

// ============================================================
// /week — Weekly summary
// ============================================================

async function showWeek(db) {
  const todayStr = getTodayIST();
  const weekAgo = new Date(todayStr);
  weekAgo.setDate(weekAgo.getDate() - 6);

  const { data: entries } = await db.from('daily_entries')
    .select('*')
    .gte('date', weekAgo.toISOString().split('T')[0])
    .lte('date', todayStr)
    .order('date', { ascending: true });

  if (!entries || entries.length === 0) {
    await sendMessage('No check-ins this week yet.');
    return;
  }

  const avg = Math.round(entries.reduce((s, e) => s + e.daily_score, 0) / entries.length);
  const best = entries.reduce((max, e) => e.daily_score > max.daily_score ? e : max);
  const worst = entries.reduce((min, e) => e.daily_score < min.daily_score ? e : min);
  const zone = getScoreZone(avg);

  const { data: streaks } = await db.from('streaks').select('*');
  const checkinStreak = streaks?.find(s => s.streak_type === 'checkin');

  let msg = `<b>This Week: ${avg}/100 avg — ${zone.label}</b>\n`;
  msg += `${entries.length}/7 days checked in\n\n`;
  msg += `Best: ${best.daily_score} (${best.date})\n`;
  msg += `Worst: ${worst.daily_score} (${worst.date})\n`;
  if (checkinStreak) msg += `\n🔥 Check-in streak: ${checkinStreak.current_count} days`;

  await sendMessage(msg);
}

// ============================================================
// /streak — Show all streaks
// ============================================================

async function showStreaks(db) {
  const { data: streaks } = await db.from('streaks').select('*').order('streak_type');

  if (!streaks) {
    await sendMessage('No streak data yet. Complete your first check-in!');
    return;
  }

  const labels = {
    checkin: '📊 Check-in', sleep: '😴 Sleep', exercise: '💪 Exercise',
    eating: '🥗 Eating', work_start: '🏢 Work Start', shaper: '🔨 Shaper',
    kids: '👨‍👧‍👦 Kids', meditation: '🧘 Meditation', gratitude: '🙏 Gratitude',
    solid_day: '⭐ Solid Day',
  };

  let msg = '<b>Current Streaks</b>\n\n';
  for (const s of streaks) {
    const icon = s.current_count > 0 ? '🔥' : '·';
    msg += `${labels[s.streak_type] || s.streak_type}: ${icon} ${s.current_count} days (best: ${s.best_count})\n`;
  }

  await sendMessage(msg);
}

// ============================================================
// /skip — Log day as intentionally skipped
// ============================================================

async function skipDay(db) {
  const todayStr = getTodayIST();

  // Check if already checked in
  const { data: existing } = await db.from('daily_entries')
    .select('id')
    .eq('date', todayStr)
    .single();

  if (existing) {
    await sendMessage("Already checked in today. Can't skip a day you've already logged.");
    return;
  }

  const entry = {
    date: todayStr,
    sleep: 1, exercise: 0, eating: 1,
    work_start: false, shaper_work: false, kids_time: false,
    meditation: false, gratitude: false,
    daily_score: 0,
    source: 'telegram',
    checked_in_at: new Date().toISOString(),
    is_skipped: true,
  };

  await db.from('daily_entries').upsert(entry, { onConflict: 'date' });
  await updateStreaks(entry, todayStr);

  await sendMessage('Day skipped. Check-in streak preserved. Rest up — tomorrow we go again.');
}

// ============================================================
// Helpers
// ============================================================

function getTodayIST() {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().split('T')[0];
}

function getSleepLabel(val) {
  const labels = { 1: '<4h', 2: '4-5h', 3: '5-6h', 4: '6-7h', 5: '7+h' };
  return labels[val] || '?';
}

function getExerciseLabel(val) {
  const labels = { 0: 'None', 1: 'Light', 2: 'Moderate', 3: 'Intense' };
  return labels[val] || '?';
}

function getEatingLabel(val) {
  const labels = { 1: 'Mostly junk', 2: 'Mixed', 3: 'Mostly clean', 4: 'All clean' };
  return labels[val] || '?';
}
