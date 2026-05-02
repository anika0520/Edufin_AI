// src/modules/user-intelligence/user-intelligence.service.js
const { query, transaction } = require('../../database/connection');
const { cache } = require('../../config/redis');
const aiProvider = require('../../config/ai-provider');
const logger = require('../../utils/logger');

const PROFILE_ANALYSIS_PROMPT = `You are an expert student counselor and psychologist with 20+ years of experience.
Analyze the student profile and provide deep psychological insights.

STUDENT PROFILE:
{PROFILE_DATA}

Respond with ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "personality_type": "one of: RIASEC_RI|RIASEC_IA|RIASEC_AS|RIASEC_SE|RIASEC_EC|RIASEC_CR|RIASEC_IRE|RIASEC_IAS|RIASEC_ECI",
  "personality_label": "e.g., Analytical Innovator | Creative Leader | ...",
  "risk_appetite": "conservative|moderate|aggressive",
  "hidden_strengths": ["strength1", "strength2", "strength3", "strength4"],
  "career_personality_summary": "2-3 sentence deep insight into who this student really is and what drives them",
  "learning_style": "visual|auditory|kinesthetic|reading_writing",
  "motivation_drivers": ["driver1", "driver2", "driver3"],
  "potential_challenges": ["challenge1", "challenge2"],
  "ideal_work_environment": "brief description",
  "leadership_potential": "low|medium|high",
  "confidence_score": 0-100,
  "key_influencing_factors": ["factor1", "factor2", "factor3"]
}`;

class UserIntelligenceService {
  /**
   * Update student profile and trigger AI analysis
   */
  async updateProfile(userId, profileData) {
    const client = await (await import('../../database/connection.js')).getClient();

    try {
      // Upsert profile data
      const existing = await query(
        'SELECT id FROM student_profiles WHERE user_id = $1',
        [userId]
      );

      const fields = this._buildUpdateFields(profileData);
      if (fields.keys.length === 0) throw new Error('No valid fields to update');

      await query(
        `UPDATE student_profiles SET ${fields.setClauses.join(', ')}, updated_at = NOW()
         WHERE user_id = $${fields.params.length + 1}`,
        [...fields.params, userId]
      );

      // Compute profile completeness
      const completeness = await this.computeCompleteness(userId);
      await query(
        'UPDATE student_profiles SET profile_completeness = $1 WHERE user_id = $2',
        [completeness, userId]
      );

      // Update user profile stage
      const stage = this._determineStage(profileData, completeness);
      await query('UPDATE users SET profile_stage = $1 WHERE id = $2', [stage, userId]);

      // Invalidate cache
      await cache.del(`profile:${userId}`);
      await cache.del(`user:${userId}`);

      logger.info('Profile updated', { userId, completeness, stage });

      // If profile is substantial enough, generate AI analysis
      if (completeness >= 40) {
        setImmediate(() => this.generateAIAnalysis(userId));
      }

      return { completeness, stage };
    } finally {
      // client not used in transaction here, just for potential future use
    }
  }

  /**
   * Full AI analysis of student profile
   */
  async generateAIAnalysis(userId) {
    try {
      const profile = await this.getFullProfile(userId);
      if (!profile) return;

      const profileSummary = this._buildProfileSummary(profile);

      const result = await aiProvider.complete({
        messages: [{ role: 'user', content: `Analyze this student:\n${profileSummary}` }],
        systemPrompt: PROFILE_ANALYSIS_PROMPT.replace('{PROFILE_DATA}', profileSummary),
        temperature: 0.3,
        maxTokens: 1500,
        jsonMode: true,
      });

      const analysis = aiProvider.parseJSON(result.content);

      // Store AI analysis
      await query(
        `UPDATE student_profiles SET
          personality_type = $1,
          risk_appetite = $2,
          hidden_strengths = $3,
          career_personality_summary = $4,
          ai_profile_generated_at = NOW()
         WHERE user_id = $5`,
        [
          analysis.personality_type,
          analysis.risk_appetite,
          analysis.hidden_strengths,
          analysis.career_personality_summary,
          userId,
        ]
      );

      // Generate and store embedding for personalization
      const embedding = await aiProvider.embed(profileSummary);
      const vectorId = `student_${userId}`;

      // Store in ChromaDB (with graceful fallback)
      await this._storeEmbedding(vectorId, embedding, {
        userId,
        personality_type: analysis.personality_type,
        risk_appetite: analysis.risk_appetite,
      });

      await query(
        'UPDATE student_profiles SET profile_vector_id = $1 WHERE user_id = $2',
        [vectorId, userId]
      );

      // Log AI decision
      await query(
        `INSERT INTO ai_decision_log (user_id, decision_type, model_used, prompt_tokens, completion_tokens, confidence_score, reasoning, key_factors)
         VALUES ($1, 'profile_analysis', $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          result.model,
          result.usage.prompt_tokens,
          result.usage.completion_tokens,
          analysis.confidence_score,
          analysis.career_personality_summary,
          JSON.stringify(analysis.key_influencing_factors || []),
        ]
      );

      // Invalidate cache
      await cache.del(`profile:${userId}`);

      logger.info('AI profile analysis complete', { userId });
      return analysis;
    } catch (err) {
      logger.error('AI profile analysis failed', { userId, error: err.message });
    }
  }

  async getFullProfile(userId) {
    const cacheKey = `profile:${userId}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.nationality, u.current_country, u.date_of_birth,
              sp.*
       FROM users u
       JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    if (!result.rows.length) return null;
    const profile = result.rows[0];
    await cache.set(cacheKey, profile, 600);
    return profile;
  }

  async computeCompleteness(userId) {
    const result = await query(
      `SELECT
        CASE WHEN highest_education IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN gpa IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN major IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN array_length(technical_skills, 1) > 0 THEN 2 ELSE 0 END +
        CASE WHEN annual_family_income IS NOT NULL THEN 2 ELSE 0 END +
        CASE WHEN target_degree IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN array_length(target_countries, 1) > 0 THEN 1 ELSE 0 END +
        CASE WHEN career_goals IS NOT NULL THEN 2 ELSE 0 END +
        CASE WHEN standardized_scores != '{}' THEN 1 ELSE 0 END +
        CASE WHEN work_experience_months > 0 THEN 1 ELSE 0 END AS score
       FROM student_profiles WHERE user_id = $1`,
      [userId]
    );

    const rawScore = result.rows[0]?.score || 0;
    return Math.min(100, Math.round((rawScore / 12) * 100));
  }

  _buildProfileSummary(profile) {
    return `
Student: ${profile.first_name} ${profile.last_name}
Age: ${profile.date_of_birth ? this._calcAge(profile.date_of_birth) : 'Unknown'}
Nationality: ${profile.nationality || 'Unknown'} | Currently in: ${profile.current_country || 'Unknown'}

ACADEMIC BACKGROUND:
- Highest Education: ${profile.highest_education || 'Not specified'}
- Major: ${profile.major || 'Not specified'}
- GPA: ${profile.gpa || 'N/A'} / ${profile.gpa_scale || 4.0}
- Institution: ${profile.institution_name || 'Not specified'}
- Grad Year: ${profile.graduation_year || 'N/A'}
- Test Scores: ${JSON.stringify(profile.standardized_scores || {})}
- Research: ${profile.research_experience || 'None'}
- Work Experience: ${profile.work_experience_months || 0} months

SKILLS & INTERESTS:
- Technical Skills: ${(profile.technical_skills || []).join(', ') || 'None listed'}
- Soft Skills: ${(profile.soft_skills || []).join(', ') || 'None listed'}
- Interests: ${(profile.interests || []).join(', ') || 'None listed'}
- Languages: ${JSON.stringify(profile.languages || [])}
- Certifications: ${(profile.certifications || []).join(', ') || 'None'}

FINANCIAL BACKGROUND:
- Annual Family Income: ${profile.annual_family_income ? `$${profile.annual_family_income} ${profile.income_currency}` : 'Not disclosed'}
- Income Bracket: ${profile.family_income_bracket || 'Unknown'}
- Savings: ${profile.savings_available ? `$${profile.savings_available}` : 'Unknown'}
- Has Property: ${profile.has_property ? 'Yes' : 'No'}
- Outstanding Loans: ${profile.outstanding_loans ? `$${profile.outstanding_loans}` : 'None'}

GOALS:
- Target Degree: ${profile.target_degree || 'Not specified'}
- Target Fields: ${(profile.target_fields || []).join(', ') || 'Not specified'}
- Target Countries: ${(profile.target_countries || []).join(', ') || 'Not specified'}
- Budget: $${profile.budget_min || 0} - $${profile.budget_max || 'Open'}
- Career Goals: ${profile.career_goals || 'Not specified'}
- Motivation: ${profile.motivation_text || 'Not provided'}
    `.trim();
  }

  _normalizeProfileData(data) {
    const n = { ...data };
    if (data.education && !data.highest_education)       n.highest_education = data.education;
    if (data.field && !data.major)                        n.major = data.field;
    if (data.current_gpa && !data.gpa)                   n.gpa = data.current_gpa;
    if (data.familyIncome && !data.annual_family_income) n.annual_family_income = data.familyIncome;
    if (data.savings && !data.savings_available)          n.savings_available = data.savings;
    if (data.current_savings && !data.savings_available) n.savings_available = data.current_savings;
    if (data.loanCapacity && !data.max_loan_comfort)      n.max_loan_comfort = data.loanCapacity;
    if (data.skills && !data.technical_skills)            n.technical_skills = data.skills;
    if (data.targetCountries && !data.target_countries)   n.target_countries = data.targetCountries;
    if (data.preferred_countries && !data.target_countries) n.target_countries = data.preferred_countries;
    if (data.riskAppetite && !data.risk_appetite)         n.risk_appetite = data.riskAppetite;
    if (data.workExperienceMonths !== undefined && data.work_experience_months === undefined)
      n.work_experience_months = data.workExperienceMonths;
    return n;
  }

  _buildUpdateFields(data) {
    const normalized = this._normalizeProfileData(data);
    const allowed = [
      'highest_education', 'gpa', 'gpa_scale', 'standardized_scores', 'major',
      'institution_name', 'graduation_year', 'research_experience', 'publications',
      'technical_skills', 'soft_skills', 'languages', 'interests', 'extracurriculars',
      'certifications', 'work_experience_months', 'work_experience_summary',
      'annual_family_income', 'income_currency', 'family_income_bracket',
      'savings_available', 'has_property', 'property_value', 'outstanding_loans',
      'has_cosigner', 'cosigner_income', 'target_degree', 'target_fields',
      'target_countries', 'target_start_year', 'budget_min', 'budget_max',
      'budget_currency', 'career_goals', 'motivation_text', 'risk_appetite',
    ];
    const keys = [], params = [], setClauses = [];
    for (const key of allowed) {
      if (normalized[key] !== undefined) {
        keys.push(key);
        params.push(normalized[key]);
        setClauses.push(`${key} = $${params.length}`);
      }
    }
    return { keys, params, setClauses };
  }

  _determineStage(data, completeness) {
    if (completeness >= 80) return 'complete';
    if (completeness >= 50) return 'financial';
    if (completeness >= 25) return 'academic';
    return 'basic';
  }

  _calcAge(dob) {
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  }

  async _storeEmbedding(id, embedding, metadata) {
    try {
      const { ChromaClient } = require('chromadb');
      const client = new ChromaClient({
        path: `http://${process.env.CHROMA_HOST || 'localhost'}:${process.env.CHROMA_PORT || 8000}`,
      });
      const collection = await client.getOrCreateCollection({
        name: process.env.CHROMA_COLLECTION_STUDENTS || 'student_profiles',
      });
      await collection.upsert({
        ids: [id],
        embeddings: [embedding],
        metadatas: [metadata],
      });
    } catch (err) {
      logger.warn('ChromaDB upsert failed (non-critical):', err.message);
    }
  }
}

module.exports = new UserIntelligenceService();
