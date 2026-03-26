// ============================================================
// Scoring Engine — maps raw habit values to points
// ============================================================

const SLEEP_POINTS = { 1: 3, 2: 6, 3: 9, 4: 12, 5: 15 };
const EXERCISE_POINTS = { 0: 0, 1: 5, 2: 10, 3: 15 };
const EATING_POINTS = { 1: 2, 2: 5, 3: 8, 4: 10 };

export function calculateScore(entry) {
  return (
    (SLEEP_POINTS[entry.sleep] || 0) +
    (EXERCISE_POINTS[entry.exercise] || 0) +
    (EATING_POINTS[entry.eating] || 0) +
    (entry.work_start ? 10 : 0) +
    (entry.shaper_work ? 15 : 0) +
    (entry.kids_time ? 15 : 0) +
    (entry.meditation ? 10 : 0) +
    (entry.gratitude ? 10 : 0)
  );
}

export function getScoreZone(score) {
  if (score >= 85) return { label: 'Crushing It', color: '#22c55e', key: 'crushing' };
  if (score >= 65) return { label: 'Solid Day', color: '#3b82f6', key: 'solid' };
  if (score >= 45) return { label: 'Slipping', color: '#f59e0b', key: 'slipping' };
  return { label: 'Red Zone', color: '#ef4444', key: 'redzone' };
}

export function getHabitPoints(habit, value) {
  switch (habit) {
    case 'sleep': return SLEEP_POINTS[value] || 0;
    case 'exercise': return EXERCISE_POINTS[value] || 0;
    case 'eating': return EATING_POINTS[value] || 0;
    case 'work_start': return value ? 10 : 0;
    case 'shaper_work': return value ? 15 : 0;
    case 'kids_time': return value ? 15 : 0;
    case 'meditation': return value ? 10 : 0;
    case 'gratitude': return value ? 10 : 0;
    default: return 0;
  }
}

export const MAX_POINTS = {
  sleep: 15, exercise: 15, eating: 10,
  work_start: 10, shaper_work: 15, kids_time: 15,
  meditation: 10, gratitude: 10,
};

export const HABIT_LABELS = {
  sleep: 'Sleep', exercise: 'Exercise', eating: 'Eating',
  work_start: 'Work Start by 8AM', shaper_work: 'Shaper Work',
  kids_time: 'Kids Time', meditation: 'Meditation', gratitude: 'Gratitude',
};

export const HABIT_ORDER = [
  'sleep', 'exercise', 'eating', 'work_start',
  'shaper_work', 'kids_time', 'meditation', 'gratitude',
];
