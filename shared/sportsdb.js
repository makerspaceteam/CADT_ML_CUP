// ============================================
// shared/sportsdb.js
// NO import/export — loaded as plain <script>
// Depends on: supabaseClient (from shared/supabase-client.js)
// ============================================

const SPORTSDB_API_KEY = '123';
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
  return { error };
}

// ---------- FETCH HELPERS ----------

async function fetchWorldCupSchedule() {
  const url = `${SPORTSDB_BASE}/eventsseason.php?id=${WORLD_CUP_LEAGUE_ID}&s=${WORLD_CUP_SEASON}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TheSportsDB error: ${res.status}`);
  const data = await res.json();
  const events = data.events || [];

  // ✅ FIX: Also fetch next 7 days individually to catch FIFA schedule updates
  // that eventsseason.php may not reflect due to caching
  const extras = await fetchUpcomingDays(7);
  const seen = new Set(events.map(e => e.idEvent));
  for (const e of extras) {
    if (!seen.has(e.idEvent)) {
      events.push(e);
      seen.add(e.idEvent);
    }
  }

  return events;
}

// ✅ NEW: Fetch N upcoming days one by one to catch schedule updates
async function fetchUpcomingDays(days) {
  const results = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
    try {
      const events = await fetchEventsByDay(dateStr);
      results.push(...events);
    } catch (e) {
      console.warn(`fetchUpcomingDays: failed for ${dateStr}`, e.message);
    }
  }
  return results;
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

// ✅ FIX: Reordered — most specific checks first so 'final' doesn't
// swallow 'round of 32', 'round of 16', etc.
function mapStage(event) {
  const round = (event.strRound || '').toLowerCase();
  const desc = (event.strDescriptionEN || '').toLowerCase();
  const combined = round + ' ' + desc;

  if (combined.includes('3rd place') || combined.includes('third place')) return { stage: 'third_place', group: null };
  if (combined.includes('round of 32') || combined.includes('r32'))        return { stage: 'round32',     group: null };
  if (combined.includes('round of 16') || combined.includes('r16'))        return { stage: 'round16',     group: null };
  if (combined.includes('quarter'))                                         return { stage: 'quarter',     group: null };
  if (combined.includes('semi'))                                            return { stage: 'semi',        group: null };
  if (combined.includes('final'))                                           return { stage: 'final',       group: null };
  if (combined.includes('group'))                                           {
    const groupMatch = combined.match(/group\s*([a-l])/i);
    return { stage: 'group', group: groupMatch ? groupMatch[1].toUpperCase() : null };
  }

  // ✅ TheSportsDB has no round label — detect stage by match date
  if (event.dateEvent) {
    const date = new Date(event.dateEvent);
    const d = date.getTime();

    const GROUP_START  = new Date('2026-06-11').getTime();
    const GROUP_END    = new Date('2026-06-28').getTime();
    const R32_START    = new Date('2026-06-28').getTime();
    const R32_END      = new Date('2026-07-04').getTime();
    const R16_START    = new Date('2026-07-04').getTime();    
    const R16_END      = new Date('2026-07-08').getTime();
    const QF_START     = new Date('2026-07-10').getTime();
    const QF_END       = new Date('2026-07-12').getTime();
    const SF_START     = new Date('2026-07-15').getTime();
    const SF_END       = new Date('2026-07-16').getTime();
    const THIRD_DATE   = new Date('2026-07-19').getTime();
    const FINAL_DATE   = new Date('2026-07-20').getTime();

    if (d >= GROUP_START && d < GROUP_END)  return { stage: 'group',       group: null };
    if (d >= R32_START   && d < R32_END)    return { stage: 'round32',     group: null };
    if (d >= R16_START   && d < R16_END)    return { stage: 'round16',     group: null };
    if (d >= QF_START    && d < QF_END)     return { stage: 'quarter',     group: null };
    if (d >= SF_START    && d < SF_END)     return { stage: 'semi',        group: null };
    if (d >= THIRD_DATE  && d < FINAL_DATE) return { stage: 'third_place', group: null };
    if (d >= FINAL_DATE)                    return { stage: 'final',       group: null };
  }

  // Last resort fallback
  return { stage: 'group', group: null };
}

// Time-based fallback so finished matches don't stay stuck on 'live'
function mapStatus(event) {
  const status = (event.strStatus || '').toLowerCase();
  const hasScore = event.intHomeScore !== null && event.intHomeScore !== undefined &&
                   event.intAwayScore !== null && event.intAwayScore !== undefined;

  if (status.includes('finished') || status === 'match finished' || status === 'ft') return 'finished';

  // If scores exist AND kickoff was 150+ minutes ago, force finished regardless of strStatus
  if (hasScore && event.dateEvent) {
    const time = event.strTime || '00:00:00';
    const kickoff = new Date(`${event.dateEvent}T${time}Z`);
    const minsAgo = (Date.now() - kickoff.getTime()) / 60000;
    if (minsAgo > 150) return 'finished';
  }

  if (status.includes('live') || status.includes('in play') ||
      status.includes('1h') || status.includes('2h') || status.includes('ht')) return 'live';

  if (hasScore && status === '') return 'finished';
  return 'upcoming';
}

const COUNTRY_FLAGS = {
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Spain': '🇪🇸', 'Portugal': '🇵🇹',
  'Netherlands': '🇳🇱', 'Belgium': '🇧🇪', 'Croatia': '🇭🇷', 'Italy': '🇮🇹',
  'Switzerland': '🇨🇭', 'Poland': '🇵🇱', 'Denmark': '🇩🇰', 'Serbia': '🇷🇸',
  'Austria': '🇦🇹', 'Turkey': '🇹🇷', 'Ukraine': '🇺🇦', 'Czech Republic': '🇨🇿',
  'Norway': '🇳🇴', 'Sweden': '🇸🇪', 'Hungary': '🇭🇺', 'Slovakia': '🇸🇰',
  'Greece': '🇬🇷', 'Romania': '🇷🇴', 'Albania': '🇦🇱',
  'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'USA': '🇺🇸', 'United States': '🇺🇸',
  'Canada': '🇨🇦', 'Mexico': '🇲🇽', 'Colombia': '🇨🇴', 'Uruguay': '🇺🇾',
  'Ecuador': '🇪🇨', 'Chile': '🇨🇱', 'Peru': '🇵🇪', 'Venezuela': '🇻🇪',
  'Bolivia': '🇧🇴', 'Paraguay': '🇵🇾', 'Costa Rica': '🇨🇷', 'Panama': '🇵🇦',
  'Honduras': '🇭🇳', 'Guatemala': '🇬🇹', 'Jamaica': '🇯🇲', 'Cuba': '🇨🇺',
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Ghana': '🇬🇭', 'Cameroon': '🇨🇲',
  'Tunisia': '🇹🇳', 'Nigeria': '🇳🇬', 'Egypt': '🇪🇬', 'Algeria': '🇩🇿',
  'Ivory Coast': '🇨🇮', "Côte d'Ivoire": '🇨🇮', 'South Africa': '🇿🇦',
  'DR Congo': '🇨🇩', 'Congo': '🇨🇬', 'Zimbabwe': '🇿🇼', 'Tanzania': '🇹🇿',
  'Comoros': '🇰🇲', 'Mali': '🇲🇱', 'Zambia': '🇿🇲',
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Saudi Arabia': '🇸🇦',
  'Australia': '🇦🇺', 'Iran': '🇮🇷', 'Qatar': '🇶🇦', 'Indonesia': '🇮🇩',
  'Iraq': '🇮🇶', 'Jordan': '🇯🇴', 'Uzbekistan': '🇺🇿', 'Thailand': '🇹🇭',
  'Vietnam': '🇻🇳', 'China': '🇨🇳', 'UAE': '🇦🇪', 'Bahrain': '🇧🇭', 'Oman': '🇴🇲',
  'New Zealand': '🇳🇿', 'New Caledonia': '🇳🇨'
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
    ? getOutcome(homeScore, awayScore) : null;

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

// ---------- SHARED UPSERT HELPER ----------

async function upsertMatchRows(rows) {
  const { data: existing, error: fetchError } = await supabaseClient
    .from('matches')
    .select('id, sportsdb_event_id, google_form_url');

  if (fetchError) throw fetchError;

  const existingMap = {};
  (existing || []).forEach(m => {
    if (m.sportsdb_event_id) existingMap[m.sportsdb_event_id] = m;
  });

  const mappedRows = rows.map(mapped => {
    const existingRow = existingMap[mapped.sportsdb_event_id];
    if (existingRow) {
      mapped.google_form_url = existingRow.google_form_url; // preserve manual links
    }
    return mapped;
  });

  const { data: upsertedRows, error: upsertError } = await supabaseClient
    .from('matches')
    .upsert(mappedRows, { onConflict: 'sportsdb_event_id' })
    .select('id, status, actual_outcome');

  if (upsertError) throw upsertError;

  const finished = (upsertedRows || []).filter(r => r.status === 'finished' && r.actual_outcome);
  for (const m of finished) {
    await recalculateMatchPoints(m.id);
  }

  return mappedRows.length;
}

// ---------- SYNC FUNCTIONS ----------

async function syncWorldCupSchedule() {
  const events = await fetchWorldCupSchedule();
  if (events.length === 0) {
    return { synced: 0, message: 'No events returned from TheSportsDB for this season.' };
  }

  const rows = events.map(mapEventToMatch);
  const count = await upsertMatchRows(rows);
  return { synced: count, message: `✅ Synced ${count} matches from TheSportsDB.` };
}

async function syncTodayMatches() {
  // ✅ FIX: Use Phnom Penh local date so UTC midnight doesn't cut off today's matches
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Phnom_Penh' });
  const events = await fetchEventsByDay(today);
  if (events.length === 0) {
    return { synced: 0, message: 'No World Cup matches scheduled today.' };
  }

  const rows = events.map(mapEventToMatch);
  const count = await upsertMatchRows(rows);
  return { synced: count, message: `✅ Synced ${count} matches for today.` };
}