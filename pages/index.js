import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

// ============================================================
// Daily Habit Tracker — Web Dashboard
// 4 views: Today, Week, Month, Streaks
// Mobile-first. Dark theme. Read-only + manual check-in fallback.
// ============================================================

const HABIT_LABELS = {
  sleep: 'Sleep', exercise: 'Exercise', eating: 'Eating',
  work_start: 'Work by 8AM', shaper_work: 'Shaper Work',
  kids_time: 'Kids Time', meditation: 'Meditation', gratitude: 'Gratitude',
};

const HABIT_ICONS = {
  sleep: '😴', exercise: '💪', eating: '🥗',
  work_start: '🏢', shaper_work: '🔨',
  kids_time: '👨‍👧‍👦', meditation: '🧘', gratitude: '🙏',
};

const HABIT_ORDER = ['sleep', 'exercise', 'eating', 'work_start', 'shaper_work', 'kids_time', 'meditation', 'gratitude'];

function getScoreZone(score) {
  if (score >= 85) return { label: 'Crushing It', color: '#22c55e' };
  if (score >= 65) return { label: 'Solid Day', color: '#3b82f6' };
  if (score >= 45) return { label: 'Slipping', color: '#f59e0b' };
  return { label: 'Red Zone', color: '#ef4444' };
}

function getScoreColor(score) {
  return getScoreZone(score).color;
}

export default function Dashboard() {
  const [view, setView] = useState('today');
  const [todayEntry, setTodayEntry] = useState(null);
  const [weekEntries, setWeekEntries] = useState([]);
  const [monthEntries, setMonthEntries] = useState([]);
  const [streaks, setStreaks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCheckin, setShowCheckin] = useState(false);
  const [checkinDate, setCheckinDate] = useState('today');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, weekRes, monthRes] = await Promise.all([
        fetch('/api/entries?range=today'),
        fetch('/api/entries?range=week'),
        fetch('/api/entries?range=month'),
      ]);
      const todayData = await todayRes.json();
      const weekData = await weekRes.json();
      const monthData = await monthRes.json();

      setTodayEntry(todayData.entries?.[0] || null);
      setWeekEntries(weekData.entries || []);
      setMonthEntries(monthData.entries || []);
      setStreaks(todayData.streaks || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const navItems = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'streaks', label: 'Streaks' },
  ];

  return (
    <>
      <Head>
        <title>Life Score</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f172a" />
      </Head>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Life Score</h1>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#1e293b', borderRadius: 12, padding: 4 }}>
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              style={{
                flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, cursor: 'pointer',
                fontSize: 14, fontWeight: 600,
                background: view === item.key ? '#3b82f6' : 'transparent',
                color: view === item.key ? '#fff' : '#94a3b8',
                transition: 'all 0.2s',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
        ) : (
          <>
            {view === 'today' && <TodayView entry={todayEntry} streaks={streaks} onCheckin={() => setShowCheckin(true)} />}
            {view === 'week' && <WeekView entries={weekEntries} />}
            {view === 'month' && <MonthView entries={monthEntries} />}
            {view === 'streaks' && <StreaksView streaks={streaks} entries={monthEntries} />}
          </>
        )}

        {showCheckin && (
          <CheckinModal
            onClose={() => setShowCheckin(false)}
            onComplete={() => { setShowCheckin(false); fetchData(); }}
          />
        )}
      </div>
    </>
  );
}

// ============================================================
// TODAY VIEW
// ============================================================

function TodayView({ entry, streaks, onCheckin }) {
  if (!entry) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
        <p style={{ color: '#94a3b8', marginBottom: 24 }}>Not checked in yet</p>
        <button onClick={onCheckin} style={btnStyle}>Log Today</button>
      </div>
    );
  }

  const zone = getScoreZone(entry.daily_score);

  return (
    <div>
      {/* Big Score */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 64, fontWeight: 800, color: zone.color }}>{entry.daily_score}</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: zone.color }}>{zone.label}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{entry.date}</div>
      </div>

      {/* Habit Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
        {HABIT_ORDER.map(h => (
          <div key={h} style={cardStyle}>
            <div style={{ fontSize: 24 }}>{HABIT_ICONS[h]}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{HABIT_LABELS[h]}</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
              {formatHabitValue(h, entry[h])}
            </div>
          </div>
        ))}
      </div>

      {/* Active Streaks */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Active Streaks</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {streaks.filter(s => s.current_count > 0).map(s => (
            <span key={s.streak_type} style={tagStyle}>
              🔥 {STREAK_LABELS[s.streak_type]} {s.current_count}d
            </span>
          ))}
          {streaks.filter(s => s.current_count > 0).length === 0 && (
            <span style={{ color: '#94a3b8', fontSize: 13 }}>No active streaks yet</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// WEEK VIEW
// ============================================================

function WeekView({ entries }) {
  if (entries.length === 0) {
    return <EmptyState message="No check-ins this week" />;
  }

  const avg = Math.round(entries.reduce((s, e) => s + e.daily_score, 0) / entries.length);
  const zone = getScoreZone(avg);
  const maxScore = Math.max(...entries.map(e => e.daily_score));

  return (
    <div>
      {/* Weekly Average */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: zone.color }}>{avg}</div>
        <div style={{ fontSize: 14, color: zone.color }}>{zone.label} (avg)</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{entries.length}/7 days</div>
      </div>

      {/* Bar Chart */}
      <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 140, gap: 6 }}>
          {entries.sort((a, b) => a.date.localeCompare(b.date)).map(e => {
            const height = maxScore > 0 ? (e.daily_score / 100) * 120 : 0;
            const color = getScoreColor(e.daily_score);
            const day = new Date(e.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' });
            return (
              <div key={e.date} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{e.daily_score}</div>
                <div style={{ height, background: color, borderRadius: 6, minHeight: 4, transition: 'height 0.3s' }} />
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{day}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Habit Heatmap */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Habit Heatmap</div>
        {HABIT_ORDER.map(h => {
          const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
          return (
            <div key={h} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ width: 80, fontSize: 11, color: '#94a3b8' }}>{HABIT_LABELS[h]}</div>
              <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                {sortedEntries.map(e => {
                  const active = isHabitActive(h, e[h]);
                  return (
                    <div
                      key={e.date}
                      style={{
                        flex: 1, height: 20, borderRadius: 4,
                        background: active ? '#22c55e' : '#ef4444',
                        opacity: active ? 1 : 0.5,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// MONTH VIEW — GitHub contribution graph style
// ============================================================

function MonthView({ entries }) {
  if (entries.length === 0) {
    return <EmptyState message="No check-ins this month" />;
  }

  const avg = Math.round(entries.reduce((s, e) => s + e.daily_score, 0) / entries.length);
  const zone = getScoreZone(avg);

  // Build calendar grid
  const dateMap = {};
  entries.forEach(e => { dateMap[e.date] = e; });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, entry: dateMap[dateStr] || null });
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: zone.color }}>{avg}</div>
        <div style={{ fontSize: 14, color: zone.color }}>{zone.label} (monthly avg)</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{entries.length}/{daysInMonth} days</div>
      </div>

      {/* Calendar Grid */}
      <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} style={{ fontSize: 10, color: '#94a3b8', padding: 4 }}>{d}</div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} />;
            const bg = cell.entry ? getScoreColor(cell.entry.daily_score) : '#1e293b';
            const opacity = cell.entry ? 1 : 0.3;
            return (
              <div
                key={i}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: 6,
                  background: bg, opacity,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600,
                }}
                title={cell.entry ? `${cell.entry.date}: ${cell.entry.daily_score}` : ''}
              >
                {cell.entry ? cell.entry.daily_score : cell.day}
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Habit Monthly Stats */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Habit Stats</div>
        {HABIT_ORDER.map(h => {
          const hitDays = entries.filter(e => isHabitActive(h, e[h])).length;
          const pct = Math.round((hitDays / entries.length) * 100);
          const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
          return (
            <div key={h} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span>{HABIT_ICONS[h]} {HABIT_LABELS[h]}</span>
                <span style={{ color: '#94a3b8' }}>{hitDays}/{entries.length} ({pct}%)</span>
              </div>
              <div style={{ height: 6, background: '#334155', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// STREAKS VIEW
// ============================================================

function StreaksView({ streaks, entries }) {
  const checkinDays = entries.filter(e => !e.is_skipped).length;
  const totalDays = entries.length > 0
    ? Math.ceil((new Date() - new Date(entries[entries.length - 1]?.date)) / 86400000) + 1
    : 0;
  const consistency = totalDays > 0 ? Math.round((checkinDays / totalDays) * 100) : 0;

  // Best single day
  const bestDay = entries.length > 0
    ? entries.reduce((best, e) => e.daily_score > best.daily_score ? e : best)
    : null;

  return (
    <div>
      {/* Consistency */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: '#3b82f6' }}>{consistency}%</div>
        <div style={{ fontSize: 14, color: '#94a3b8' }}>Check-in Consistency</div>
      </div>

      {/* Current Streaks */}
      <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Current Streaks</div>
        {streaks.map(s => (
          <div key={s.streak_type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #334155' }}>
            <span style={{ fontSize: 13 }}>
              {s.current_count > 0 ? '🔥' : '·'} {STREAK_LABELS[s.streak_type]}
            </span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: s.current_count > 0 ? '#22c55e' : '#94a3b8' }}>
                {s.current_count}
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>
                (best: {s.best_count})
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Hall of Fame */}
      <div style={{ ...cardStyle, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Hall of Fame</div>
        {bestDay && (
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
            Best Day: <span style={{ color: '#22c55e', fontWeight: 600 }}>{bestDay.daily_score}/100</span> on {bestDay.date}
          </div>
        )}
        {streaks.filter(s => s.best_count > 0).map(s => (
          <div key={s.streak_type} style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>
            Best {STREAK_LABELS[s.streak_type]} streak: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{s.best_count} days</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MANUAL CHECK-IN MODAL
// ============================================================

function CheckinModal({ onClose, onComplete }) {
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [dateMode, setDateMode] = useState('today'); // 'today' | 'yesterday'

  const questions = [
    { field: 'sleep', text: 'How many hours did you sleep?', options: [
      { label: '<4 hours', value: 1 }, { label: '4-5 hours', value: 2 },
      { label: '5-6 hours', value: 3 }, { label: '6-7 hours', value: 4 }, { label: '7+ hours', value: 5 },
    ]},
    { field: 'exercise', text: 'Did you exercise today?', options: [
      { label: 'No exercise', value: 0 }, { label: 'Walk/stretching', value: 1 },
      { label: '30-45 min', value: 2 }, { label: '60+ min intense', value: 3 },
    ]},
    { field: 'eating', text: 'How was your eating?', options: [
      { label: 'Mostly junk', value: 1 }, { label: 'Mixed', value: 2 },
      { label: 'Mostly clean', value: 3 }, { label: 'All clean', value: 4 },
    ]},
    { field: 'work_start', text: 'Left the house by 8 AM?', options: [
      { label: 'Yes', value: true }, { label: 'No', value: false },
    ]},
    { field: 'shaper_work', text: 'Shaper work today?', options: [
      { label: 'Yes', value: true }, { label: 'No', value: false },
    ]},
    { field: 'kids_time', text: 'Meaningful kids time?', options: [
      { label: 'Yes', value: true }, { label: 'No', value: false },
    ]},
    { field: 'meditation', text: 'Meditated? (5 min counts)', options: [
      { label: 'Yes', value: true }, { label: 'No', value: false },
    ]},
    { field: 'gratitude', text: 'Practiced gratitude?', options: [
      { label: 'Yes', value: true }, { label: 'No', value: false },
    ]},
  ];

  const handleAnswer = async (value) => {
    const q = questions[step];
    const newResponses = { ...responses, [q.field]: value };
    setResponses(newResponses);

    if (step < 7) {
      setStep(step + 1);
    } else {
      // Submit
      setSubmitting(true);
      const today = new Date();
      const ist = new Date(today.getTime() + (5.5 * 60 * 60 * 1000));
      if (dateMode === 'yesterday') ist.setDate(ist.getDate() - 1);
      const dateStr = ist.toISOString().split('T')[0];

      try {
        const res = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newResponses, date: dateStr }),
        });
        if (res.ok) onComplete();
        else {
          const err = await res.json();
          alert(err.error || 'Failed to save');
          setSubmitting(false);
        }
      } catch {
        alert('Network error');
        setSubmitting(false);
      }
    }
  };

  if (submitting) {
    return (
      <div style={modalOverlay}>
        <div style={modalContent}>
          <div style={{ textAlign: 'center', padding: 40 }}>Saving...</div>
        </div>
      </div>
    );
  }

  const q = questions[step];

  return (
    <div style={modalOverlay}>
      <div style={modalContent}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{step + 1}/8</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        {step === 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setDateMode('today')}
              style={{ ...tagStyle, background: dateMode === 'today' ? '#3b82f6' : '#334155' }}
            >Today</button>
            <button
              onClick={() => setDateMode('yesterday')}
              style={{ ...tagStyle, background: dateMode === 'yesterday' ? '#3b82f6' : '#334155' }}
            >Yesterday</button>
          </div>
        )}

        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>{q.text}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.options.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => handleAnswer(opt.value)}
              style={{
                padding: '14px 16px', background: '#334155', border: '1px solid #475569',
                borderRadius: 10, color: '#f1f5f9', fontSize: 14, fontWeight: 500,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SHARED COMPONENTS & STYLES
// ============================================================

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
      <p>{message}</p>
    </div>
  );
}

const STREAK_LABELS = {
  checkin: 'Check-in', sleep: 'Sleep', exercise: 'Exercise',
  eating: 'Eating', work_start: 'Work Start', shaper: 'Shaper',
  kids: 'Kids', meditation: 'Meditation', gratitude: 'Gratitude',
  solid_day: 'Solid Day',
};

function formatHabitValue(habit, value) {
  if (habit === 'sleep') return { 1: '<4h', 2: '4-5h', 3: '5-6h', 4: '6-7h', 5: '7+h' }[value] || '?';
  if (habit === 'exercise') return { 0: 'None', 1: 'Light', 2: 'Moderate', 3: 'Intense' }[value] || '?';
  if (habit === 'eating') return { 1: 'Junk', 2: 'Mixed', 3: 'Clean', 4: 'All clean' }[value] || '?';
  return value ? '✅' : '❌';
}

function isHabitActive(habit, value) {
  if (habit === 'exercise') return value > 0;
  if (habit === 'sleep' || habit === 'eating') return true; // Always > 0
  return value === true;
}

const cardStyle = {
  background: '#1e293b', borderRadius: 12, padding: 12, textAlign: 'center',
};

const tagStyle = {
  padding: '4px 10px', background: '#334155', borderRadius: 6, fontSize: 12,
  fontWeight: 600, color: '#f1f5f9', border: 'none', cursor: 'pointer',
};

const btnStyle = {
  padding: '14px 32px', background: '#3b82f6', border: 'none', borderRadius: 12,
  color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer',
};

const modalOverlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
  justifyContent: 'center', zIndex: 100, padding: 16,
};

const modalContent = {
  background: '#1e293b', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400,
};
