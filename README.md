# CADTML Cup 2026 — Website

A prediction-competition website for the CADTML Cup 2026, where students sign up,
view live World Cup match schedules, submit predictions via Google Forms, and
compete on a points-based leaderboard.

## 📁 Project Structure

```
cadtml-cup/
├── index.html              # Landing page (rules, scoring, how it works)
├── login.html               # Login page
├── signup.html              # Sign up page
├── matches.html             # Match schedule (live/upcoming/finished, filters)
├── leaderboard.html          # Ranking leaderboard
├── admin.html                # Admin panel (matches, results, predictions, CSV import)
├── shared/
│   ├── supabase-client.js   # Supabase connection config (EDIT THIS)
│   ├── auth.js              # Auth helper functions
│   ├── scoring.js           # Scoring logic helpers
│   └── style.css            # Global styling (CADTML branding)
└── supabase_schema.sql       # Full database schema — run in Supabase SQL Editor
```

## 🚀 Setup Steps

### 1. Create a Supabase Project
- Go to https://supabase.com → New Project
- Wait for it to finish provisioning

### 2. Run the Database Schema
- Open **SQL Editor** in Supabase dashboard
- Paste the entire contents of `supabase_schema.sql` and run it
- This creates: `profiles`, `matches`, `predictions` tables, the `leaderboard` view,
  the `calculate_match_points()` function, and all Row Level Security policies

### 3. Connect Your Credentials
- In Supabase: **Project Settings → API**
- Copy your **Project URL** and **anon public key**
- Open `shared/supabase-client.js` and replace:
  ```js
  const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
  const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
  ```

### 4. (Optional) Disable Email Confirmation for Faster Testing
- Supabase → **Authentication → Providers → Email**
- Toggle off "Confirm email" while testing (re-enable for production if desired)

### 5. Create Your First Admin User
- Sign up normally through `signup.html`
- In Supabase → **Table Editor → profiles**, find your row
- Edit `is_admin` to `true`
- You can now access `admin.html`

### 6. Add Matches
- Go to `admin.html` → **Matches** tab
- Add each World Cup match: teams, stage/group, date/time, venue, and the
  **Google Form link** for that specific match
- Update `status` to `live` during the match, and `finished` after

### 7. Enter Results & Score Predictions
- After a match ends, go to **Enter Results** tab
- Select the match, input the final score, and click **Save Result & Calculate Points**
- This automatically scores ALL predictions for that match using the rules below

### 8. Import Predictions from Google Form
Two ways to get predictions into the system:

**Option A — Manual entry** (Manual Predictions tab)
- Pick a student + match, enter their predicted score/outcome/confidence, save

**Option B — CSV bulk import** (CSV Import tab)
- In Google Forms → Responses → open linked Google Sheet → File → Download → CSV
- Make sure your Google Form / Sheet has columns matching:
  - `email` (student's signup email — used to match their account)
  - `match_id` (the numeric match ID, visible in the Matches tab)
  - `predicted_home_score`
  - `predicted_away_score`
  - `predicted_outcome` (`home` / `away` / `draw`)
  - `confidence` (optional: `low` / `medium` / `high`)
- Upload the CSV in the CSV Import tab and click **Process & Import**

> 💡 Tip: You may need to add a hidden question to your Google Form asking for
> the student's "Match ID" (a dropdown of match numbers), since each match has
> its own form link/section.

## 🔄 Auto-Syncing Matches from TheSportsDB

Instead of (or in addition to) manually adding matches, the admin panel can pull
fixtures and live scores from [TheSportsDB](https://www.thesportsdb.com) (free API,
FIFA World Cup `idLeague=4429`).

- **Matches → API Sync tab**:
  - **Sync Full Schedule** — pulls all World Cup 2026 fixtures and upserts them
  - **Sync Today's Matches** — lighter call, just refreshes today's games (good for live scores)
  - **Auto-sync toggle** — polls "today's matches" every 2 minutes while the admin tab is open

- Matches are matched/deduped via a `sportsdb_event_id` column, so re-syncing won't
  create duplicates, and your manually-entered **Google Form links are preserved**.
- When a synced match gets a final score, points are **automatically recalculated**
  for all predictions on that match.
- Free tier rate limit: 30 requests/minute — fine for manual + 2-min auto-sync.
- **After syncing**, review the Matches tab: stage/group detection from the API is
  heuristic, so double-check group letters and knockout stages, and add each
  match's Google Form URL (the API doesn't know about your forms).

If you already ran `supabase_schema.sql` before this feature was added, run the
migration at the bottom of that file to add the `sportsdb_event_id` column.

## 🏆 Scoring Rules

| Prediction | Points |
|---|---|
| Correct match outcome (Win/Loss/Draw) | 3 |
| Correct goal difference (if outcome correct) | +2 |
| Exact final score | +5 bonus |
| Correct high-confidence prediction | +2 bonus |
| **Maximum per match** | **12** |

## 🌐 Hosting

This is a static site — no server build step needed. You can host it on:
- **Netlify** / **Vercel** (drag & drop the folder, or connect a Git repo)
- **GitHub Pages**
- Supabase Storage (as a static bucket, with some config)

Just make sure `shared/supabase-client.js` has your real credentials before deploying.
