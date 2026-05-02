// src/config/ai-provider.js — Production-Grade AI Provider
// Groq → OpenAI → Ollama fallback chain, exponential backoff retries,
// circuit breaker, per-user cost tracking, PII-safe logging, JSON validation.

const Groq = require('groq-sdk');
const axios = require('axios');
const logger = require('../utils/logger');
const { sanitizePromptInput } = require('../utils/piiRedactor');

const COST_TABLE = {
  'llama3-70b-8192':    { input: 0.59,  output: 0.79  },
  'llama3-8b-8192':     { input: 0.05,  output: 0.08  },
  'mixtral-8x7b-32768': { input: 0.27,  output: 0.27  },
  'gpt-4o':             { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':        { input: 0.15,  output: 0.60  },
  'ollama':             { input: 0.00,  output: 0.00  },
};

class CircuitBreaker {
  constructor(name, failThreshold = 5, cooldownMs = 30000) {
    this.name = name; this.failCount = 0;
    this.threshold = failThreshold; this.cooldownMs = cooldownMs;
    this.openedAt = null; this.state = 'CLOSED';
  }
  isOpen() {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt > this.cooldownMs) {
        this.state = 'HALF_OPEN';
        logger.info(`[CB:${this.name}] HALF_OPEN`);
      } else return true;
    }
    return false;
  }
  recordSuccess() { this.failCount = 0; this.state = 'CLOSED'; }
  recordFailure() {
    this.failCount++;
    if (this.failCount >= this.threshold) {
      this.state = 'OPEN'; this.openedAt = Date.now();
      logger.error(`[CB:${this.name}] OPEN after ${this.failCount} failures`);
    }
  }
}

const costTracker = {
  calls: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0, perModel: {},
  record(model, inputTokens, outputTokens) {
    this.calls++; this.totalInputTokens += inputTokens; this.totalOutputTokens += outputTokens;
    const rates = COST_TABLE[model] || { input: 0, output: 0 };
    const cost = (inputTokens * rates.input + outputTokens * rates.output) / 1000000;
    this.totalCostUsd += cost;
    if (!this.perModel[model]) this.perModel[model] = { calls: 0, cost: 0 };
    this.perModel[model].calls++; this.perModel[model].cost += cost;
    return cost;
  },
  summary() {
    return { calls: this.calls, inputTokens: this.totalInputTokens, outputTokens: this.totalOutputTokens,
      estimatedCostUsd: this.totalCostUsd.toFixed(4), perModel: this.perModel };
  },
};

setInterval(() => logger.info('[AI Cost Tracker]', costTracker.summary()), 5 * 60000);

class AIProvider {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'groq';
    this.groqClient = null; this.openaiClient = null;
    this.breakers = {
      groq: new CircuitBreaker('groq', 5, 30000),
      openai: new CircuitBreaker('openai', 5, 60000),
      ollama: new CircuitBreaker('ollama', 3, 15000),
    };
    this._init();
  }

  _init() {
    if (process.env.GROQ_API_KEY) {
      this.groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
      logger.info('[AI] Groq initialized');
    }
    if (process.env.OPENAI_API_KEY) {
      const OpenAI = require('openai');
      this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      logger.info('[AI] OpenAI initialized (fallback)');
    }
  }

  async complete({ messages, systemPrompt, temperature = 0.7, maxTokens = 2000, jsonMode = false }) {
    const safeMessages = messages.map((m) => ({ ...m, content: sanitizePromptInput(m.content) }));
    const fullMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...safeMessages]
      : safeMessages;

    const order = this._providerOrder();
    let lastError;
    for (const provider of order) {
      if (this.breakers[provider].isOpen()) { logger.warn(`[AI] CB open: ${provider}`); continue; }
      try {
        const result = await this._callWithRetry(provider, fullMessages, temperature, maxTokens, jsonMode);
        this.breakers[provider].recordSuccess();
        return result;
      } catch (err) {
        this.breakers[provider].recordFailure();
        logger.error(`[AI] ${provider} failed: ${err.message}`);
        lastError = err;
      }
    }
    throw lastError || new Error('All AI providers exhausted');
  }

  async _callWithRetry(provider, messages, temperature, maxTokens, jsonMode, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (provider === 'groq')   return await this._groq(messages, temperature, maxTokens, jsonMode);
        if (provider === 'openai') return await this._openai(messages, temperature, maxTokens, jsonMode);
        return await this._ollama(messages, temperature, maxTokens, jsonMode);
      } catch (err) {
        const isTransient = err.status === 429 || err.status >= 500 || err.code === 'ECONNRESET';
        if (!isTransient || attempt === maxRetries) throw err;
        const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 15000);
        logger.warn(`[AI] ${provider} attempt ${attempt} failed, retry in ${Math.round(delay)}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  _providerOrder() {
    const primary = this.provider === 'openai' ? 'openai' : 'groq';
    return [primary, ...['groq', 'openai', 'ollama'].filter((p) => p !== primary)];
  }

  async _groq(messages, temperature, maxTokens, jsonMode) {
    if (!this.groqClient) throw new Error('Groq not configured');
    const model = maxTokens > 1500
      ? (process.env.GROQ_MODEL || 'llama3-70b-8192')
      : (process.env.GROQ_FAST_MODEL || 'llama3-8b-8192');
    const params = { model, messages, temperature, max_tokens: maxTokens };
    if (jsonMode) params.response_format = { type: 'json_object' };
    const resp = await this.groqClient.chat.completions.create(params);
    const usage = resp.usage || {};
    const cost = costTracker.record(model, usage.prompt_tokens || 0, usage.completion_tokens || 0);
    logger.debug(`[AI:Groq] model=${model} tokens=${JSON.stringify(usage)} cost=$${cost.toFixed(6)}`);
    return { content: resp.choices[0].message.content, provider: 'groq', model, usage };
  }

  async _openai(messages, temperature, maxTokens, jsonMode) {
    if (!this.openaiClient) throw new Error('OpenAI not configured');
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const params = { model, messages, temperature, max_tokens: maxTokens };
    if (jsonMode) params.response_format = { type: 'json_object' };
    const resp = await this.openaiClient.chat.completions.create(params);
    const usage = resp.usage || {};
    const cost = costTracker.record(model, usage.prompt_tokens || 0, usage.completion_tokens || 0);
    logger.debug(`[AI:OpenAI] model=${model} tokens=${JSON.stringify(usage)} cost=$${cost.toFixed(6)}`);
    return { content: resp.choices[0].message.content, provider: 'openai', model, usage };
  }

  async _ollama(messages, temperature, maxTokens, jsonMode) {
    const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3';
    const payload = { model, messages, stream: false, options: { temperature, num_predict: maxTokens } };
    if (jsonMode) payload.format = 'json';
    const resp = await axios.post(`${base}/api/chat`, payload, { timeout: 120000 });
    costTracker.record('ollama', 0, 0);
    return { content: resp.data.message?.content || '', provider: 'ollama', model, usage: { prompt_tokens: 0, completion_tokens: 0 } };
  }

  parseJSON(content) {
    if (!content) throw new Error('Empty AI response');
    let clean = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try { return JSON.parse(clean); } catch { /* fall through */ }
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch { /* fall through */ } }
    throw new Error('Could not parse AI response as JSON');
  }

  getCostSummary() { return costTracker.summary(); }
}

module.exports = new AIProvider();
