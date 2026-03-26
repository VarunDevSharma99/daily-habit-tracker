// ============================================================
// Quote Bank — 20 quotes, contextual selection rules
// ============================================================

export const QUOTES = [
  // Core Quotes (1-3)
  { id: 1, text: "Do the work. Everyone wants to be successful, but nobody wants to do the work.", category: 'core' },
  { id: 2, text: "If something stands between you and your success, MOVE IT.", category: 'core' },
  { id: 3, text: "We can change our lives. We can do, have, and be exactly what we wish.", category: 'core' },
  // Power Quotes (4-7)
  { id: 4, text: "Success isn't always about greatness. It's about consistency. Consistent hard work leads to success.", category: 'discipline' },
  { id: 5, text: "Be humble. Be hungry. And always be the hardest worker in the room.", category: 'power' },
  { id: 6, text: "Wake up determined. Go to bed satisfied.", category: 'power' },
  { id: 7, text: "Blood, sweat, and respect. First two you give. Last one you earn.", category: 'power' },
  // Aggressive Push Quotes (8-10)
  { id: 8, text: "You want to hug it out? Fine. But tomorrow you better come in swinging.", category: 'aggressive' },
  { id: 9, text: "Nobody is going to hand you anything. You want it? Go take it.", category: 'aggressive' },
  { id: 10, text: "Excuses are for people who don't want it badly enough.", category: 'aggressive' },
  // Discipline Quotes (11-15)
  { id: 11, text: "Discipline is choosing between what you want now and what you want most.", category: 'discipline' },
  { id: 12, text: "The pain of discipline weighs ounces. The pain of regret weighs tons.", category: 'discipline' },
  { id: 13, text: "You don't have to be extreme, just consistent.", category: 'discipline' },
  { id: 14, text: "Hard work beats talent when talent doesn't work hard.", category: 'discipline' },
  { id: 15, text: "Small daily improvements over time lead to stunning results.", category: 'discipline' },
  // Comeback / Resilience Quotes (16-20)
  { id: 16, text: "Fall seven times, stand up eight.", category: 'comeback' },
  { id: 17, text: "It doesn't matter how slowly you go, as long as you don't stop.", category: 'comeback' },
  { id: 18, text: "A setback is a setup for a comeback.", category: 'comeback' },
  { id: 19, text: "The only bad workout is the one that didn't happen.", category: 'comeback' },
  { id: 20, text: "Yesterday is gone. Tomorrow is a mystery. Today is yours to own.", category: 'comeback' },
];

// Score-based quote selection per spec Section 7
const SCORE_QUOTE_POOLS = {
  crushing: [4, 5, 13, 14, 15],      // 85+: discipline/consistency
  solid: [1, 2, 3, 6, 7],            // 65-84: core + power
  slipping: [8, 9, 10, 11, 12],      // 45-64: aggressive push
  redzone: [1, 2, 10, 16, 17, 18],   // <45: comeback + confrontation
};

const STREAK_QUOTE_POOL = [4, 13, 14];
const COMEBACK_KING_QUOTE_ID = 2;

export function selectQuote(scoreZoneKey, lastQuoteId, { isStreakMilestone = false, isComebackKing = false } = {}) {
  if (isComebackKing) return QUOTES.find(q => q.id === COMEBACK_KING_QUOTE_ID);

  const pool = isStreakMilestone
    ? STREAK_QUOTE_POOL
    : (SCORE_QUOTE_POOLS[scoreZoneKey] || SCORE_QUOTE_POOLS.solid);

  // Filter out last used quote to prevent repeats
  const available = pool.filter(id => id !== lastQuoteId);
  const chosenId = available[Math.floor(Math.random() * available.length)];
  return QUOTES.find(q => q.id === chosenId);
}
