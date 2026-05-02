// src/modules/behavioral/behavioral.service.js
const { query } = require('../../database/connection');
const { cache } = require('../../config/redis');
const aiProvider = require('../../config/ai-provider');
const logger = require('../../utils/logger');

const NUDGE_GENERATION_PROMPT = `You are a conversion optimization expert for an education loan platform.

Student behavior data:
{BEHAVIOR_DATA}

Student profile summary:
{PROFILE_SUMMARY}

Current funnel stage: {FUNNEL_STAGE}
Loan intent score: {INTENT_SCORE}/100

Generate a personalized, non-spammy nudge that feels helpful, not pushy.

Respond with ONLY valid JSON:
{
  "should_nudge": true,
  "nudge_type": "in_app|email",
  "trigger_reason": "brief internal reason",
  "message_title": "compelling, personalized title",
  "message_body": "2-3 sentence personalized message that provides value",
  "cta_text": "action button text",
  "cta_url": "/relevant-page",
  "priority": "low|normal|high",
  "personalization_elements": ["what makes this nudge specific to this student"]
}`;

class BehavioralService {
  /**
   * Track user behavioral event
   */
  async trackEvent(userId, eventData) {
    const { eventType, page, elementId, properties, sessionId, ipAddress, userAgent } = eventData;

    await query(
      `INSERT INTO behavioral_events (user_id, session_id, event_type, page, element_id, properties, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8)`,
      [userId, sessionId, eventType, page, elementId, JSON.stringify(properties || {}), ipAddress, userAgent]
    );

    // Async score update (don't block response)
    setImmediate(() => this._updateBehavioralScore(userId).catch(logger.error));

    return { tracked: true };
  }

  async getBehavioralScore(userId) {
    const cacheKey = `behavioral:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const result = await query(
      'SELECT * FROM behavioral_scores WHERE user_id = $1',
      [userId]
    );

    if (!result.rows.length) return null;
    const score = result.rows[0];
    await cache.set(cacheKey, score, 300);
    return score;
  }

  /**
   * Update behavioral score based on all events
   */
  async _updateBehavioralScore(userId) {
    try {
      const events = await query(
        `SELECT event_type, page, properties, created_at
         FROM behavioral_events
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
         ORDER BY created_at DESC`,
        [userId]
      );

      const evts = events.rows;
      if (!evts.length) return;

      // Compute metrics
      const totalSessions = new Set(evts.map(e => e.created_at.toDateString())).size;
      const loanPageVisits = evts.filter(e => e.page?.includes('loan')).length;
      const calcInteractions = evts.filter(e => e.event_type === 'calculator_interaction').length;
      const formStarts = evts.filter(e => e.event_type === 'form_start').length;
      const formAbandons = evts.filter(e => e.event_type === 'form_abandon').length;
      const totalPages = evts.filter(e => e.event_type === 'page_view').length;
      const timeSpentEvents = evts.filter(e => e.event_type === 'time_spent');
      const avgDuration = timeSpentEvents.length
        ? timeSpentEvents.reduce((s, e) => s + (e.properties?.duration_seconds || 0), 0) / timeSpentEvents.length
        : 0;

      // Loan intent score algorithm
      let intentScore = 0;
      intentScore += Math.min(30, loanPageVisits * 5);          // Up to 30 points for loan page visits
      intentScore += Math.min(20, calcInteractions * 4);        // Up to 20 for calculator use
      intentScore += Math.min(15, formStarts * 7);              // Up to 15 for form starts
      intentScore -= Math.min(10, formAbandons * 3);            // Penalize abandons
      intentScore += Math.min(10, totalSessions * 2);           // Session frequency
      intentScore += avgDuration > 300 ? 15 : avgDuration / 20; // Long sessions

      // Engagement score
      let engagementScore = Math.min(100,
        (totalPages * 2) +
        (totalSessions * 5) +
        (avgDuration / 10) +
        (calcInteractions * 3)
      );

      // Funnel stage determination
      let funnelStage = 'awareness';
      if (intentScore >= 70) funnelStage = 'intent';
      else if (intentScore >= 50) funnelStage = 'consideration';
      else if (intentScore >= 25) funnelStage = 'interest';
      if (formStarts > 0 && formAbandons === 0) funnelStage = 'application';

      // Drop-off point detection
      const lastAbandoned = evts.find(e => e.event_type === 'form_abandon');

      await query(
        `INSERT INTO behavioral_scores (
          user_id, loan_intent_score, engagement_score,
          total_sessions, avg_session_duration_seconds, total_pages_viewed,
          loan_page_visits, calculator_interactions,
          funnel_stage, drop_off_point, last_active_at, computed_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          loan_intent_score = $2, engagement_score = $3,
          total_sessions = $4, avg_session_duration_seconds = $5,
          total_pages_viewed = $6, loan_page_visits = $7,
          calculator_interactions = $8, funnel_stage = $9,
          drop_off_point = $10, last_active_at = NOW(), computed_at = NOW(), updated_at = NOW()`,
        [
          userId,
          Math.min(100, Math.max(0, Math.round(intentScore))),
          Math.round(engagementScore),
          totalSessions,
          Math.round(avgDuration),
          totalPages,
          loanPageVisits,
          calcInteractions,
          funnelStage,
          lastAbandoned?.page || null,
        ]
      );

      await cache.del(`behavioral:${userId}`);

      // Check if nudge should be sent
      if (Math.round(intentScore) >= 40) {
        await this._checkAndSendNudge(userId, Math.round(intentScore), funnelStage);
      }

    } catch (err) {
      logger.error('Behavioral score update failed:', err.message);
    }
  }

  async _checkAndSendNudge(userId, intentScore, funnelStage) {
    // Cooldown check
    const cooldownHours = parseInt(process.env.NUDGE_COOLDOWN_HOURS) || 4;
    const recentNudge = await query(
      `SELECT id FROM nudges WHERE user_id = $1 AND sent_at > NOW() - INTERVAL '${cooldownHours} hours' LIMIT 1`,
      [userId]
    );
    if (recentNudge.rows.length) return; // Don't spam

    // Get profile for personalization
    const profileRes = await query(
      'SELECT first_name, career_goals, target_degree FROM student_profiles WHERE user_id = $1',
      [userId]
    );
    const profile = profileRes.rows[0];

    const behaviorData = `
Loan page visits: High
Calculator interactions: Multiple
Funnel stage: ${funnelStage}
Intent score: ${intentScore}/100
    `;

    const result = await aiProvider.complete({
      systemPrompt: NUDGE_GENERATION_PROMPT
        .replace('{BEHAVIOR_DATA}', behaviorData)
        .replace('{PROFILE_SUMMARY}', JSON.stringify(profile || {}))
        .replace('{FUNNEL_STAGE}', funnelStage)
        .replace('{INTENT_SCORE}', intentScore),
      messages: [{ role: 'user', content: 'Generate a nudge.' }],
      temperature: 0.7,
      maxTokens: 500,
      jsonMode: true,
    });

    const nudge = aiProvider.parseJSON(result.content);

    if (!nudge.should_nudge) return;

    await query(
      `INSERT INTO nudges (user_id, nudge_type, trigger_reason, message_title, message_body, cta_text, cta_url, priority, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent', NOW())`,
      [
        userId,
        nudge.nudge_type,
        nudge.trigger_reason,
        nudge.message_title,
        nudge.message_body,
        nudge.cta_text,
        nudge.cta_url,
        nudge.priority,
      ]
    );

    logger.info('Nudge sent', { userId, type: nudge.nudge_type, priority: nudge.priority });
  }

  async getPendingNudges(userId) {
    const result = await query(
      `SELECT * FROM nudges WHERE user_id = $1 AND status = 'sent' ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );
    return result.rows;
  }

  async dismissNudge(userId, nudgeId) {
    await query(
      'UPDATE nudges SET status = $1, dismissed_at = NOW() WHERE id = $2 AND user_id = $3',
      ['dismissed', nudgeId, userId]
    );
    return { dismissed: true };
  }

  async clickNudge(userId, nudgeId) {
    await query(
      'UPDATE nudges SET status = $1, clicked_at = NOW() WHERE id = $2 AND user_id = $3',
      ['clicked', nudgeId, userId]
    );
    return { clicked: true };
  }
}

module.exports = new BehavioralService();
