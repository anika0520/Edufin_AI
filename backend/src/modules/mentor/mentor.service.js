// src/modules/mentor/mentor.service.js
const { query } = require('../../database/connection');
const { cache } = require('../../config/redis');
const aiProvider = require('../../config/ai-provider');
const userIntelligenceService = require('../user-intelligence/user-intelligence.service');
const logger = require('../../utils/logger');

const MENTOR_SYSTEM_PROMPT = `You are EduFin Mentor - a world-class AI student counselor combining career expertise, financial intelligence, and emotional intelligence.

You are talking to: {STUDENT_NAME}

STUDENT PROFILE CONTEXT:
{PROFILE_CONTEXT}

CAREER RECOMMENDATIONS:
{CAREER_CONTEXT}

LOAN STATUS:
{LOAN_CONTEXT}

YOUR PERSONALITY:
- Warm, empathetic, encouraging but realistic
- Data-driven but explains things in simple terms
- Never condescending - treat students as intelligent adults
- Acknowledge anxiety and uncertainty with compassion
- Use concrete examples and numbers
- Ask clarifying questions when needed

CAPABILITIES:
- Career counseling & path planning
- University selection advice
- Loan guidance and financial planning
- Emotional support and motivation
- Study tips and productivity advice
- Visa and application process guidance

RULES:
- Never give false hope - be honest but kind
- Always cite your reasoning
- If uncertain, say so clearly
- For legal/medical advice, always refer to professionals
- Maintain conversation context and remember what was discussed
- Use student's first name occasionally to personalize

CONVERSATION HISTORY:
{CONVERSATION_HISTORY}`;

const SENTIMENT_DETECTION_PROMPT = `Analyze this message and respond with ONLY JSON:
Message: "{MESSAGE}"
{"sentiment": "positive|neutral|negative|anxious|frustrated|excited", "topics": ["career|loan|university|emotional|study|visa"], "urgency": "low|medium|high"}`;

class MentorService {
  async startSession(userId, topic = 'general') {
    const result = await query(
      `INSERT INTO chat_sessions (user_id, session_name, topic)
       VALUES ($1, $2, $3) RETURNING *`,
      [userId, `${topic} - ${new Date().toLocaleDateString()}`, topic]
    );
    return result.rows[0];
  }

  async sendMessage(userId, sessionId, userMessage) {
    // Validate session belongs to user
    const sessionRes = await query(
      'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2 AND is_active = TRUE',
      [sessionId, userId]
    );
    if (!sessionRes.rows.length) throw new Error('Session not found');

    // Get conversation history (last 20 messages for context)
    const historyRes = await query(
      `SELECT role, content, created_at FROM chat_messages
       WHERE session_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [sessionId]
    );
    const history = historyRes.rows.reverse();

    // Detect sentiment
    const sentiment = await this._detectSentiment(userMessage);

    // Save user message
    await query(
      `INSERT INTO chat_messages (session_id, user_id, role, content, sentiment, topics_detected)
       VALUES ($1, $2, 'user', $3, $4, $5)`,
      [sessionId, userId, userMessage, sentiment.sentiment, sentiment.topics]
    );

    // Build rich context for the AI
    const context = await this._buildMentorContext(userId);

    // Build conversation history string
    const historyStr = history
      .map(m => `${m.role === 'user' ? 'Student' : 'Mentor'}: ${m.content}`)
      .join('\n');

    // Build messages for AI
    const messages = [
      ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: userMessage },
    ];

    // If emotional distress detected, adjust response style
    const systemPrompt = this._buildSystemPrompt(context, historyStr, sentiment);

    // Generate AI response
    const result = await aiProvider.complete({
      systemPrompt,
      messages,
      temperature: 0.7,
      maxTokens: 1000,
    });

    const assistantMessage = result.content;

    // Save assistant message
    await query(
      `INSERT INTO chat_messages (session_id, user_id, role, content, tokens_used, context_used)
       VALUES ($1, $2, 'assistant', $3, $4, $5)`,
      [
        sessionId, userId, assistantMessage,
        (result.usage.prompt_tokens + result.usage.completion_tokens),
        JSON.stringify({ profile_used: !!context.profile, career_used: !!context.career }),
      ]
    );

    // Update session
    await query(
      `UPDATE chat_sessions
       SET message_count = message_count + 2,
           total_tokens_used = total_tokens_used + $1,
           last_message_at = NOW()
       WHERE id = $2`,
      [result.usage.prompt_tokens + result.usage.completion_tokens, sessionId]
    );

    // Track behavioral event
    await this._trackChatBehavior(userId, sessionId, sentiment);

    return {
      message: assistantMessage,
      sessionId,
      sentiment: sentiment.sentiment,
      topicsDiscussed: sentiment.topics,
    };
  }

  async getSessions(userId) {
    const result = await query(
      `SELECT cs.*, COUNT(cm.id) as actual_message_count
       FROM chat_sessions cs
       LEFT JOIN chat_messages cm ON cm.session_id = cs.id
       WHERE cs.user_id = $1
       GROUP BY cs.id
       ORDER BY cs.last_message_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async getSessionMessages(userId, sessionId) {
    const session = await query(
      'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    if (!session.rows.length) throw new Error('Session not found');

    const messages = await query(
      `SELECT id, role, content, sentiment, topics_detected, created_at
       FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId]
    );

    return { session: session.rows[0], messages: messages.rows };
  }

  async closeSession(userId, sessionId) {
    await query(
      'UPDATE chat_sessions SET is_active = FALSE WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    return { message: 'Session closed' };
  }

  async _detectSentiment(message) {
    try {
      const result = await aiProvider.complete({
        messages: [{
          role: 'user',
          content: SENTIMENT_DETECTION_PROMPT.replace('{MESSAGE}', message.substring(0, 500))
        }],
        temperature: 0.1,
        maxTokens: 100,
        jsonMode: true,
      });
      return aiProvider.parseJSON(result.content);
    } catch (e) {
      return { sentiment: 'neutral', topics: ['general'], urgency: 'low' };
    }
  }

  async _buildMentorContext(userId) {
    const cacheKey = `mentor_context:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const [profileRes, careerRes, loanRes] = await Promise.all([
      userIntelligenceService.getFullProfile(userId),
      query('SELECT career_title, rank, entry_salary_usd, probability_score FROM career_recommendations WHERE user_id = $1 AND is_active = TRUE ORDER BY rank', [userId]),
      query('SELECT status, eligibility_score, suggested_amount_usd, risk_category FROM loan_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]),
    ]);

    const context = {
      profile: profileRes,
      career: careerRes.rows,
      loan: loanRes.rows[0] || null,
    };

    await cache.set(cacheKey, context, 300);
    return context;
  }

  _buildSystemPrompt(context, historyStr, sentiment) {
    const profile = context.profile;
    const name = profile ? `${profile.first_name} ${profile.last_name}` : 'Student';

    const profileContext = profile ? `
- Personality: ${profile.personality_type || 'Unknown'} | Risk Appetite: ${profile.risk_appetite || 'Unknown'}
- Education: ${profile.highest_education || 'Unknown'} in ${profile.major || 'Unknown'}
- GPA: ${profile.gpa || 'N/A'} | Work Exp: ${profile.work_experience_months || 0} months
- Goals: ${profile.career_goals || 'Not specified'}
- Target: ${profile.target_degree || 'Unknown'} in ${(profile.target_countries || []).join(', ') || 'Unknown'}
- Financial: ${profile.family_income_bracket || 'Unknown'} income bracket
- Hidden Strengths: ${(profile.hidden_strengths || []).join(', ') || 'Not analyzed yet'}
- Profile Summary: ${profile.career_personality_summary || 'Not analyzed yet'}` : 'Profile incomplete';

    const careerContext = context.career.length > 0
      ? context.career.map(c => `${c.rank}. ${c.career_title} (${c.probability_score}% match, $${c.entry_salary_usd} entry salary)`).join('\n')
      : 'No career recommendations generated yet';

    const loanContext = context.loan
      ? `Status: ${context.loan.status} | Eligibility: ${context.loan.eligibility_score}% | Suggested: $${context.loan.suggested_amount_usd} | Risk: ${context.loan.risk_category}`
      : 'No loan assessment yet';

    // Add emotional intelligence layer
    let emotionalGuidance = '';
    if (sentiment.sentiment === 'anxious' || sentiment.sentiment === 'frustrated') {
      emotionalGuidance = '\n\nIMPORTANT: Student seems anxious/frustrated. Start with empathy and validation before giving information. Be extra warm and reassuring.';
    } else if (sentiment.sentiment === 'excited') {
      emotionalGuidance = '\n\nStudent is excited! Match their energy while keeping advice grounded and realistic.';
    }

    return MENTOR_SYSTEM_PROMPT
      .replace('{STUDENT_NAME}', name)
      .replace('{PROFILE_CONTEXT}', profileContext)
      .replace('{CAREER_CONTEXT}', careerContext)
      .replace('{LOAN_CONTEXT}', loanContext)
      .replace('{CONVERSATION_HISTORY}', historyStr || 'This is the start of our conversation.') +
      emotionalGuidance;
  }

  async _trackChatBehavior(userId, sessionId, sentiment) {
    try {
      await query(
        `INSERT INTO behavioral_events (user_id, session_id, event_type, page, properties)
         VALUES ($1, $2, 'chat_interaction', 'mentor', $3)`,
        [userId, sessionId, JSON.stringify({ sentiment: sentiment.sentiment, topics: sentiment.topics })]
      );
    } catch (e) {
      // Non-critical
    }
  }
}

module.exports = new MentorService();
