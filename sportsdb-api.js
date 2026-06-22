// ============================================
// THESPORTSDB API INTEGRATION
// ============================================
// Free API docs: https://www.thesportsdb.com/documentation
// FIFA World Cup idLeague = 4429
// Free tier API key = "123" (rate limit: 30 requests/minute)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SPORTSDB_API_KEY = '123'; // Replace with your premium key if you have one
const SPORTSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_API_KEY}`;
const WORLD_CUP_LEAGUE_ID = '4429';
const WORLD_CUP_SEASON = '2026';

// ---------- HELPERS ----------

function getOutcome(home, away) {
  if (home > away) return 'home';
  if (away > home) return 'away';
  return 'draw';
}

async function recalculateMatchPoints(matchId) {
  const { error } = await supabaseClient.rpc('calculate_match_points', { p_match_id: matchId });
  if (error) console.error('Failed to recalculate points for match', matchId, error);
}

// ---------- FETCH HELPERS ----------

async function fetchWorldCupSchedule() {
  const url = `${SPORTSDB_BASE}/eventsseason.php?id=${WORLD_CUP_LEAGUE_ID}&s=${WORLD_CUP_SEASON}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TheSportsDB error: ${res.status}`);
  const data = await res.json();
  return data.events || [];
}

async function fetchEventsByDay(dateStr) {
  const url = `${SPORTSDB_BASE}/eventsday.php?d=${dateStr}&l=${WORLD_CUP_LEAGUE_ID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TheSportsDB error: ${res.status}`);
  const data = await res.json();
  return data.events || [];
}

async function fetchEventById(idEvent) {
  const url = `${SPORTSDB_BASE}/lookupevent.php?id=${idEvent}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TheSportsDB error: ${res.status}`);
  const data = await res.json();
  return (data.events && data.events[0]) || null;
}

// ---------- MAPPING HELPERS ----------

// Map TheSportsDB stage/round to internal stage enum.
// 2026 World Cup: 48 teams → Group Stage → Round of 32 → R16 → QF → SF → 3rd place → Final
function mapStage(event) {
  const round = (event.strRound || '').toLowerCase();
  const desc = (event.strDescriptionEN || '').toLowerCase();
  const combined = round + ' ' + desc;

  if (combined.includes('final') && combined.includes('3rd')) return { stage: 'third_place', group: null };
  if (combined.includes('final') && !combined.includes('semi') && !combined.includes('quarter')) return { stage: 'final', group: null };
  if (combined.includes('semi')) return { stage: 'semi', group: null };
  if (combined.includes('quarter')) return { stage: 'quarter', group: null };
  if (combined.includes('round of 16') || combined.includes('r16')) return { stage: 'round16', group: null };
  // NOTE: 2026 has a new Round of 32 (48-team format). Mapped to 'round32'.
  // Make sure your schema's stage CHECK constraint includes 'round32'.
  if (combined.includes('round of 32') || combined.includes('r32')) return { stage: 'round32', group: null };

  // Group stage — extract group letter (A–L for 48-team format)
  const groupMatch = combined.match(/group\s*([a-l])/i);
  return { stage: 'group', group: groupMatch ? groupMatch[1].toUpperCase() : null };
}

function mapStatus(event) {
  const status = (event.strStatus || '').toLowerCase();
  const homeScore = event.intHomeScore;
  const awayScore = event.intAwayScore;
  const hasScore = homeScore !== null && homeScore !== undefined &&
                   awayScore !== null && awayScore !== undefined;

  if (status.includes('finished') || status === 'match finished' || status === 'ft') return 'finished';
  if (status.includes('live') || status.includes('in play') || status.includes('1h') || status.includes('2h')) return 'live';
  if (hasScore && status === '') return 'finished'; // fallback heuristic
  return 'upcoming';
}

// Fixed: Wales, Scotland, England now use proper regional flag emojis
const COUNTRY_FLAGS = {
  // Europe
  'England':        '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Wales':          '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Scotland':       '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'France':         '🇫🇷',
  'Germany':        '🇩🇪',
  'Spain':          '🇪🇸',
  'Portugal':       '🇵🇹',
  'Netherlands':    '🇳🇱',
  'Belgium':        '🇧🇪',
  'Croatia':        '🇭🇷',
  'Italy':          '🇮🇹',
  'Switzerland':    '🇨🇭',
  'Poland':         '🇵🇱',
  'Denmark':        '🇩🇰',
  'Serbia':         '🇷🇸',
  'Austria':        '🇦🇹',
  'Turkey':         '🇹🇷',
  'Ukraine':        '🇺🇦',
  'Czech Republic': '🇨🇿',
  'Norway':         '🇳🇴',
  'Sweden':         '🇸🇪',
  'Hungary':        '🇭🇺',
  'Slovakia':       '🇸🇰',
  'Greece':         '🇬🇷',
  'Romania':        '🇷🇴',
  'Albania':        '🇦🇱',

  // Americas
  'Argentina':      '🇦🇷',
  'Brazil':         '🇧🇷',
  'USA':            '🇺🇸',
  'United States':  '🇺🇸',
  'Canada':         '🇨🇦',
  'Mexico':         '🇲🇽',
  'Colombia':       '🇨🇴',
  'Uruguay':        '🇺🇾',
  'Ecuador':        '🇪🇨',
  'Chile':          '🇨🇱',
  'Peru':           '🇵🇪',
  'Venezuela':      '🇻🇪',
  'Bolivia':        '🇧🇴',
  'Paraguay':       '🇵🇾',
  'Costa Rica':     '🇨🇷',
  'Panama':         '🇵🇦',
  'Honduras':       '🇭🇳',
  'Guatemala':      '🇬🇹',
  'Jamaica':        '🇯🇲',
  'Cuba':           '🇨🇺',

  // Africa
  'Morocco':        '🇲🇦',
  'Senegal':        '🇸🇳',
  'Ghana':          '🇬🇭',
  'Cameroon':       '🇨🇲',
  'Tunisia':        '🇹🇳',
  'Nigeria':        '🇳🇬',
  'Egypt':          '🇪🇬',
  'Algeria':        '🇩🇿',
  'Ivory Coast':    '🇨🇮',
  "Côte d'Ivoire":  '🇨🇮',
  'South Africa':   '🇿🇦',
  'DR Congo':       '🇨🇩',
  'Congo':          '🇨🇬',
  'Zimbabwe':       '🇿🇼',
  'Tanzania':       '🇹🇿',
  'Comoros':        '🇰🇲',
  'Mali':           '🇲🇱',
  'Zambia':         '🇿🇲',

  // Asia & Middle East
  'Japan':          '🇯🇵',
  'South Korea':    '🇰🇷',
  'Saudi Arabia':   '🇸🇦',
  'Australia':      '🇦🇺',
  'Iran':           '🇮🇷',
  'Qatar':          '🇶🇦',
  'Indonesia':      '🇮🇩',
  'Iraq':           '🇮🇶',
  'Jordan':         '🇯🇴',
  'Uzbekistan':     '🇺🇿',
  'Thailand':       '🇹🇭',
  'Vietnam':        '🇻🇳',
  'China':          '🇨🇳',
  'UAE':            '🇦🇪',
  'Bahrain':        '🇧🇭',
  'Oman':           '🇴🇲',

  // Oceania
  'New Zealand':    '🇳🇿',
  'New Caledonia':  '🇳🇨',
};

function getFlag(teamName) {
  return COUNTRY_FLAGS[teamName] || '🏳️';
}

function mapEventToMatch(event) {
  const { stage, group } = mapStage(event);
  const status = mapStatus(event);

  let matchDate = null;
  if (event.dateEvent) {
    const time = event.strTime || '00:00:00';
    matchDate = new Date(`${event.dateEvent}T${time}Z`).toISOString();
  }

  const homeScore = event.intHomeScore !== null && event.intHomeScore !== undefined && event.intHomeScore !== ''
    ? parseInt(event.intHomeScore) : null;
  const awayScore = event.intAwayScore !== null && event.intAwayScore !== undefined && event.intAwayScore !== ''
    ? parseInt(event.intAwayScore) : null;

  const outcome = (homeScore !== null && awayScore !== null)
    ? getOutcome(homeScore, awayScore)
    : null;

  return {
    sportsdb_event_id: event.idEvent,
    stage,
    group_name: group,
    team_home: event.strHomeTeam,
    team_away: event.strAwayTeam,
    team_home_flag: getFlag(event.strHomeTeam),
    team_away_flag: getFlag(event.strAwayTeam),
    match_date: matchDate,
    status,
    actual_home_score: homeScore,
    actual_away_score: awayScore,
    actual_outcome: outcome,
    venue: event.strVenue || null
  };
}

// ---------- SYNC FUNCTIONS ----------

async function syncWorldCupSchedule() {
  const events = await fetchWorldCupSchedule();
  if (events.length === 0) {
    return { synced: 0, message: 'No events returned from TheSportsDB for this season.' };
  }

  const { data: existing, error: fetchError } = await supabaseClient
    .from('matches')
    .select('id, sportsdb_event_id, google_form_url');

  if (fetchError) throw fetchError;

  const existingMap = {};
  (existing || []).forEach(m => {
    if (m.sportsdb_event_id) existingMap[m.sportsdb_event_id] = m;
  });

  const rows = events.map(ev => {
    const mapped = mapEventToMatch(ev);
    const existingRow = existingMap[mapped.sportsdb_event_id];
    if (existingRow) {
      mapped.id = existingRow.id;
      mapped.google_form_url = existingRow.google_form_url;
    }
    return mapped;
  });

  const { error: upsertError } = await supabaseClient
    .from('matches')
    .upsert(rows, { onConflict: 'sportsdb_event_id' });

  if (upsertError) throw upsertError;

  const finishedWithScores = rows.filter(r => r.status === 'finished' && r.actual_outcome);
  for (const m of finishedWithScores) {
    if (m.id) await recalculateMatchPoints(m.id);
  }

  return { synced: rows.length, message: `Synced ${rows.length} matches from TheSportsDB.` };
}

async function syncTodayMatches() {
  const today = new Date().toISOString().slice(0, 10);
  const events = await fetchEventsByDay(today);
  if (events.length === 0) {
    return { synced: 0, message: 'No World Cup matches scheduled today.' };
  }

  const { data: existing, error: fetchError } = await supabaseClient
    .from('matches')
    .select('id, sportsdb_event_id, google_form_url');

  if (fetchError) throw fetchError;

  const existingMap = {};
  (existing || []).forEach(m => {
    if (m.sportsdb_event_id) existingMap[m.sportsdb_event_id] = m;
  });

  const rows = events.map(ev => {
    const mapped = mapEventToMatch(ev);
    const existingRow = existingMap[mapped.sportsdb_event_id];
    if (existingRow) {
      mapped.id = existingRow.id;
      mapped.google_form_url = existingRow.google_form_url;
    }
    return mapped;
  });

  const { error: upsertError } = await supabaseClient
    .from('matches')
    .upsert(rows, { onConflict: 'sportsdb_event_id' });

  if (upsertError) throw upsertError;

  const finishedWithScores = rows.filter(r => r.status === 'finished' && r.actual_outcome);
  for (const m of finishedWithScores) {
    if (m.id) await recalculateMatchPoints(m.id);
  }

  return { synced: rows.length, message: `Synced ${rows.length} matches for today.` };
}

export {
  fetchWorldCupSchedule,
  fetchEventsByDay,
  fetchEventById,
  syncWorldCupSchedule,
  syncTodayMatches,
  recalculateMatchPoints,
  mapEventToMatch,
  getFlag,
};