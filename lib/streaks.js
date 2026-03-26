import { getServiceClient } from './supabase.js';

// ============================================================
// Streak Engine — updates all 10 streak types after check-in
// ============================================================

// Maps habit field → streak_type in the streaks table
const HABIT_TO_STREAK = {
  sleep: 'sleep',
  exercise: 'exercise',
  eating: 'eating',
  work_start: 'work_start',
  shaper_work: 'shaper',
  kids_time: 'kids',
  meditation: 'meditation',
  gratitude: 'gratitude',
};

function isHabitActive(entry, habit) {
  switch (habit) {
    case 'sleep': return entry.sleep > 0;         // Always true since min is 1
    case 'exercise': return entry.exercise > 0;    // 0 = "No exercise" breaks streak
    case 'eating': return entry.eating > 0;        // Always true since min is 1
    case 'work_start': return entry.work_start === true;
    case 'shaper_work': return entry.shaper_work === true;
    case 'kids_time': return entry.kids_time === true;
    case 'meditation': return entry.meditation === true;
    case 'gratitude': return entry.gratitude === true;
    default: return false;
  }
}

export async function updateStreaks(entry, entryDate) {
  const db = getServiceClient();
  const { data: streaks } = await db.from('streaks').select('*');

  const updates = [];
  const milestones = [];
  const MILESTONE_THRESHOLDS = [7, 14, 30, 60, 90, 180, 365];

  for (const streak of streaks) {
    let active = false;

    if (streak.streak_type === 'checkin') {
      active = !entry.is_skipped; // Check-in streak: preserved on skip, but here we handle normal
      // Actually per spec: /skip preserves check-in streak
      active = true; // If we're in updateStreaks, a check-in or skip happened
    } else if (streak.streak_type === 'solid_day') {
      active = entry.daily_score >= 65;
    } else {
      const habit = Object.keys(HABIT_TO_STREAK).find(
        k => HABIT_TO_STREAK[k] === streak.streak_type
      );
      if (habit) {
        // /skip breaks all individual habit streaks
        active = entry.is_skipped ? false : isHabitActive(entry, habit);
      }
    }

    // Check if this streak is consecutive (last_active_date should be yesterday)
    const yesterday = new Date(entryDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newCount;
    if (active) {
      // If last active was yesterday, continue streak. Otherwise start fresh.
      if (streak.last_active_date === yesterdayStr || streak.current_count === 0) {
        newCount = streak.current_count + 1;
      } else {
        newCount = 1; // Gap detected, restart
      }
    } else {
      newCount = 0; // Streak broken
    }

    const newBest = Math.max(streak.best_count, newCount);

    // Check for milestone
    if (MILESTONE_THRESHOLDS.includes(newCount) && newCount > streak.current_count) {
      milestones.push({ type: streak.streak_type, count: newCount });
    }

    updates.push({
      id: streak.id,
      streak_type: streak.streak_type,
      current_count: newCount,
      best_count: newBest,
      last_active_date: active ? entryDate : streak.last_active_date,
      updated_at: new Date().toISOString(),
    });
  }

  // Batch update
  for (const update of updates) {
    await db.from('streaks').update(update).eq('id', update.id);
  }

  return { updates, milestones };
}

export async function getStreaks() {
  const db = getServiceClient();
  const { data } = await db.from('streaks').select('*');
  return data || [];
}
