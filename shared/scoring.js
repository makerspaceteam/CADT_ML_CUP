// ============================================
// SCORING UTILITIES
// ============================================
// Mirrors the logic in the Postgres function calculate_match_points()
// Used for client-side previews (e.g. admin panel point preview).
// Actual scoring is done server-side via RPC for consistency.

const POINTS = {
  CORRECT_OUTCOME: 3,
  CORRECT_GOAL_DIFF: 2,
  EXACT_SCORE_BONUS: 5,
  HIGH_CONFIDENCE_BONUS: 2,
  MAX_PER_MATCH: 12
};

// Determine outcome ('home' | 'away' | 'draw') from two scores
function getOutcome(homeScore, awayScore) {
  if (homeScore > awayScore) return 'home';
  if (homeScore < awayScore) return 'away';
  return 'draw';
}

// Preview points for a single prediction given the actual result
function previewPoints(prediction, match) {
  if (match.actual_home_score == null || match.actual_away_score == null) return null;

  let pts = 0;
  const actualOutcome = match.actual_outcome || getOutcome(match.actual_home_score, match.actual_away_score);

  const PENALTY_STAGES = ['round32', 'round16', 'quarter', 'semi', 'third_place', 'final'];
  const isKnockout = PENALTY_STAGES.includes(match.stage);

  let userOutcome = prediction.predicted_outcome;
  if (isKnockout && prediction.predicted_outcome === 'draw' && prediction.predicted_pen_winner) {
    userOutcome = prediction.predicted_pen_winner === match.team_home ? 'home' : 'away';
  }

  // ✅ Goal diff — always checked regardless of outcome
  if (prediction.predicted_home_score != null && prediction.predicted_away_score != null) {
    const predDiff = prediction.predicted_home_score - prediction.predicted_away_score;
    const actualDiff = match.actual_home_score - match.actual_away_score;
    if (predDiff === actualDiff) pts += POINTS.CORRECT_GOAL_DIFF;
  }

  if (userOutcome === actualOutcome) {
    pts += POINTS.CORRECT_OUTCOME;

    // ✅ High confidence — only if outcome correct
    if (prediction.confidence === 'high') {
      pts += POINTS.HIGH_CONFIDENCE_BONUS;
    }
  }

  // ✅ Exact score — always checked
  if (prediction.predicted_home_score === match.actual_home_score &&
      prediction.predicted_away_score === match.actual_away_score) {
    pts += POINTS.EXACT_SCORE_BONUS;
  }

  return Math.min(pts, POINTS.MAX_PER_MATCH);
}

// Trigger server-side recalculation for a match (call after entering result)
async function recalculateMatchPoints(matchId) {
  const { error } = await supabaseClient.rpc('calculate_match_points', { p_match_id: matchId });
  return { error };
}
