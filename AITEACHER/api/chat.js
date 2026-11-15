'use strict';

const MODEL_PREFERENCES = [
  process.env.GROQ_MODEL,
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'qwen/qwen3-32b',
  'meta-llama/llama-4-scout-17b-16e-instruct'
].filter(Boolean);
const SYSTEM_PROMPT = 'Ты — персональный AI-репетитор TezBilim. Отвечай естественно, конкретно и на языке ученика, учитывай историю чата и контекст задания. Отвечай по существу на последний вопрос, объясняй материал понятно и задавай один полезный уточняющий вопрос. Если ученик просит готовый ответ, помоги ему прийти к нему самостоятельно, не раскрывая решение целиком.';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Используйте POST-запрос.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Не настроен GROQ_API_KEY. Добавьте Groq API key в переменные окружения Vercel.' });
  }

  let body;
  try { body = req.body; }
  catch (error) {
    console.error('Invalid JSON received by Groq endpoint:', error);
    return res.status(400).json({ error: 'Тело запроса содержит некорректный JSON.' });
  }
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: 'Некорректный JSON запроса.' }); }
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const conversation = messages
    .filter(message => message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
    .slice(-20)
    .map(message => ({ role: message.role, content: message.content.slice(0, 4000) }))
    .filter(message => message.content.trim());

  if (!conversation.length || !conversation.some(message => message.role === 'user')) {
    return res.status(400).json({ error: 'Добавьте сообщение ученика перед отправкой.' });
  }

  const context = typeof body.context === 'string' ? body.context.slice(0, 6000) : '';
  try {
    const modelsResponse = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000)
    });
    const modelsPayload = await modelsResponse.json().catch(() => ({}));
    if (!modelsResponse.ok) {
      console.error('Groq model listing failed:', modelsResponse.status, modelsPayload.error?.message || 'Unknown Groq API error');
      return res.status(502).json({ error: `Не удалось проверить доступные модели Groq (HTTP ${modelsResponse.status}).` });
    }
    const availableIds = new Set((modelsPayload.data || []).map(model => model.id));
    const model = MODEL_PREFERENCES.find(candidate => availableIds.has(candidate));
    if (!model) {
      const sample = [...availableIds].filter(id => !/whisper|guard|embedding/i.test(id)).slice(0, 8);
      console.error('No preferred Groq chat model is available for this key.');
      return res.status(503).json({ error: `Для этого Groq-ключа не нашлась поддерживаемая чат-модель. Доступные варианты: ${sample.join(', ') || 'не получены'}. Укажите одну из них в GROQ_MODEL.` });
    }

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}\n\nКонтекст задания и ученика:\n${context || 'Контекст не предоставлен.'}` },
          ...conversation
        ],
        temperature: 0.5,
        max_tokens: 500
      }),
      signal: AbortSignal.timeout(10000)
    });

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = result.error?.message || `Groq API вернул ошибку (${upstream.status}) для модели ${model}.`;
      console.error('Groq request failed:', upstream.status, message);
      return res.status(upstream.status === 429 ? 429 : 502).json({ error: upstream.status === 429 ? 'Groq ограничил частоту запросов. Подождите и попробуйте снова.' : message });
    }

    const reply = result.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: 'Groq вернул пустой ответ. Попробуйте ещё раз.' });
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Groq endpoint error:', error);
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return res.status(504).json({ error: 'Groq не ответил вовремя. Попробуйте ещё раз.' });
    }
    return res.status(502).json({ error: 'Не удалось подключиться к Groq. Проверьте интернет или попробуйте позже.' });
  }
};
