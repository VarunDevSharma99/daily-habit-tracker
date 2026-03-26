# Daily Habit Tracker + Life Score — Setup Guide

Total time: ~15 minutes. Do these in order.

---

## Step 1: Create Supabase Project (5 min)

1. Go to [supabase.com](https://supabase.com) → Sign up with GitHub or email
2. Click "New Project" → Name it `life-score` → Set a database password → Create
3. Wait for project to provision (1-2 min)
4. Go to **Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_KEY`
5. Go to **SQL Editor → New Query** → Paste the entire contents of `supabase/schema.sql` → Run

---

## Step 2: Create Telegram Bot (2 min)

1. Open Telegram → Search for `@BotFather` → Start chat
2. Send `/newbot`
3. Name it: `Dev Life Score` (display name)
4. Username: `DevLifeScoreBot` (or any available name ending in `Bot`)
5. Copy the **bot token** → `TELEGRAM_BOT_TOKEN`

---

## Step 3: Get Your Telegram Chat ID (2 min)

1. Open your new bot in Telegram → Send it any message (e.g., "hello")
2. Visit this URL in your browser (replace YOUR_TOKEN):
   ```
   https://api.telegram.org/botYOUR_TOKEN/getUpdates
   ```
3. Find `"chat":{"id": 123456789}` in the response
4. Copy that number → `TELEGRAM_CHAT_ID`

---

## Step 4: Deploy to Vercel (5 min)

1. Push this project folder to a new GitHub repo
   ```bash
   cd daily-habit-tracker
   git init
   git add .
   git commit -m "Initial: Daily Habit Tracker"
   git remote add origin https://github.com/YOUR_USERNAME/daily-habit-tracker.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
3. Click "Add New Project" → Import the `daily-habit-tracker` repo
4. In the **Environment Variables** section, add all 6 variables:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `CRON_SECRET` (generate any random string, e.g., `openssl rand -hex 32`)
5. Click **Deploy**

---

## Step 5: Register Telegram Webhook (30 sec)

After deploy completes, visit this URL once in your browser:
```
https://YOUR-APP.vercel.app/api/telegram/set-webhook
```

You should see `"ok": true` in the response. Done — the bot is now live.

---

## Step 6: Test It

1. Open Telegram → Go to your bot → Send `/checkin`
2. Tap through all 8 questions
3. You should see your score + nudge message
4. Visit `https://YOUR-APP.vercel.app` to see the dashboard

---

## Cron Schedule (auto-configured in vercel.json)

| Time (IST) | What | Cron (UTC) |
|---|---|---|
| 7:30 AM | Morning pattern alert | `0 2 * * *` |
| 9:00 PM | Check-in prompt | `30 15 * * *` |
| 9:30 PM | Nudge reminder | `0 16 * * *` |
| 12:01 AM | Midnight close | `31 18 * * *` |
| Sunday 10 AM | Weekly summary | `30 4 * * 0` |
| 1st of month 10 AM | Monthly report | `30 4 1 * *` |

**Note:** Vercel free tier supports cron jobs but they run once per day on the Hobby plan. For the 9PM/9:30PM/midnight schedule to work with minute precision, you'll need Vercel Pro ($20/mo) or use an external cron service like [cron-job.org](https://cron-job.org) (free) to hit the endpoints.

---

## Troubleshooting

- **Bot doesn't respond:** Check webhook is set (Step 5). Check `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are correct.
- **Dashboard shows no data:** Check Supabase keys. Verify schema was run in SQL Editor.
- **Cron not firing:** Verify `CRON_SECRET` matches in Vercel env vars. Check Vercel plan for cron support.
