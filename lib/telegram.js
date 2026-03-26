// ============================================================
// Telegram Bot API Helper
// ============================================================

const API_BASE = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = () => process.env.TELEGRAM_CHAT_ID;

export async function sendMessage(text, replyMarkup = null) {
  const body = {
    chat_id: CHAT_ID(),
    text,
    parse_mode: 'HTML',
  };
  if (replyMarkup) {
    body.reply_markup = JSON.stringify(replyMarkup);
  }

  const res = await fetch(`${API_BASE()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function editMessage(messageId, text, replyMarkup = null) {
  const body = {
    chat_id: CHAT_ID(),
    message_id: messageId,
    text,
    parse_mode: 'HTML',
  };
  if (replyMarkup) {
    body.reply_markup = JSON.stringify(replyMarkup);
  }

  const res = await fetch(`${API_BASE()}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function answerCallbackQuery(callbackQueryId, text = '') {
  const res = await fetch(`${API_BASE()}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
  return res.json();
}

export function isAuthorized(chatId) {
  return String(chatId) === String(CHAT_ID());
}

// ============================================================
// Question definitions — the 8 habits in order
// ============================================================

export const QUESTIONS = [
  {
    index: 0,
    field: 'sleep',
    text: 'How many hours did you sleep last night?',
    keyboard: {
      inline_keyboard: [[
        { text: '<4 hours', callback_data: 'sleep_1' },
        { text: '4-5 hours', callback_data: 'sleep_2' },
        { text: '5-6 hours', callback_data: 'sleep_3' },
        { text: '6-7 hours', callback_data: 'sleep_4' },
        { text: '7+ hours', callback_data: 'sleep_5' },
      ]],
    },
  },
  {
    index: 1,
    field: 'exercise',
    text: 'Did you exercise today?',
    keyboard: {
      inline_keyboard: [[
        { text: 'No exercise', callback_data: 'exercise_0' },
        { text: 'Walk/stretching (<20 min)', callback_data: 'exercise_1' },
        { text: '30-45 min workout', callback_data: 'exercise_2' },
        { text: '60+ min intense', callback_data: 'exercise_3' },
      ]],
    },
  },
  {
    index: 2,
    field: 'eating',
    text: 'How was your eating today?',
    keyboard: {
      inline_keyboard: [[
        { text: 'Mostly junk', callback_data: 'eating_1' },
        { text: 'Mixed', callback_data: 'eating_2' },
        { text: 'Mostly clean', callback_data: 'eating_3' },
        { text: 'All clean', callback_data: 'eating_4' },
      ]],
    },
  },
  {
    index: 3,
    field: 'work_start',
    text: 'Did you leave the house and start work by 8 AM today?',
    keyboard: {
      inline_keyboard: [[
        { text: 'Yes', callback_data: 'work_start_true' },
        { text: 'No', callback_data: 'work_start_false' },
      ]],
    },
  },
  {
    index: 4,
    field: 'shaper_work',
    text: 'Did you do any Shaper work today? (Deep work on business-building, not firefighting)',
    keyboard: {
      inline_keyboard: [[
        { text: 'Yes', callback_data: 'shaper_work_true' },
        { text: 'No', callback_data: 'shaper_work_false' },
      ]],
    },
  },
  {
    index: 5,
    field: 'kids_time',
    text: 'Did you spend meaningful time with your kids today?',
    keyboard: {
      inline_keyboard: [[
        { text: 'Yes', callback_data: 'kids_time_true' },
        { text: 'No', callback_data: 'kids_time_false' },
      ]],
    },
  },
  {
    index: 6,
    field: 'meditation',
    text: 'Did you meditate today? (Even 5 minutes counts)',
    keyboard: {
      inline_keyboard: [[
        { text: 'Yes', callback_data: 'meditation_true' },
        { text: 'No', callback_data: 'meditation_false' },
      ]],
    },
  },
  {
    index: 7,
    field: 'gratitude',
    text: 'Did you practice gratitude today?',
    keyboard: {
      inline_keyboard: [[
        { text: 'Yes', callback_data: 'gratitude_true' },
        { text: 'No', callback_data: 'gratitude_false' },
      ]],
    },
  },
];
