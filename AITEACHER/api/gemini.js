'use strict';

const MODELS = ['gemini-3.8-flash-lite', 'gemini-3.8-flash'];
const REQUEST_TIMEOUT_MS = 8000;
const SYSTEM_PROMPT = 'Ты — персональный AI-репетитор EduPulse. Отвечай естественно, конкретно и на языке ученика, учитывай историю чата и контекст задания. Не ограничивайся готовыми заготовленными фразами: отвечай по существу на последний вопрос, объясняй материал шаг за шагом и задавай один полезный уточняющий вопрос. Если ученик просит готовый ответ, помоги ему прийти к нему самостоятельно, не раскрывая решение целиком.';

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Используйте POST-запрос.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'На сервере не настроен GEMINI_API_KEY. Добавьте ключ Gemini в переменные окружения хостинга.' });
  }

  let body;
  try { body = req.body; }
  catch (error) {
    console.error('Invalid JSON received by Gemini endpoint:', error);
    return res.status(400).json({ error: 'Тело запроса содержит некорректный JSON.' });
  }
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: 'Некорректный JSON запроса.' }); }
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const conversation = messages
    .filter(message => message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
    .slice(-30)
    .map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content.slice(0, 6000) }] }))
    .filter(message => message.parts[0].text.trim());

  if (!conversation.length || conversation[conversation.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Добавьте сообщение ученика перед отправкой.' });
  }

  const context = typeof body.context === 'string' ? body.context.slice(0, 8000) : '';
  try {
    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}\n\nКонтекст задания и ученика:\n${context || 'Контекст не предоставлен.'}` }] },
      contents: conversation,
      generationConfig: { temperature: 0.6, maxOutputTokens: 700 }
    });
    let upstream;
    let result = {};
    for (const model of MODELS) {
      upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      result = await upstream.json().catch(() => ({}));
      if (upstream.ok || (upstream.status !== 503 && upstream.status !== 429 && upstream.status !== 404)) break;
      console.warn(`Gemini model ${model} unavailable (${upstream.status}); trying the next model.`);
    }

    if (!upstream.ok) {
      console.error('Gemini request failed:', upstream.status, result.error?.message || 'Unknown Gemini API error');
      const errorMessage = upstream.status === 503 || upstream.status === 429
        ? 'Gemini сейчас перегружен или ограничил запросы. Попробуйте позже.'
        : result.error?.message || `Gemini API вернул ошибку (${upstream.status}). Проверьте ключ и доступность модели.`;
      return res.status(upstream.status === 503 || upstream.status === 429 ? upstream.status : 502).json({ error: errorMessage });
    }

    const reply = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!reply) return res.status(502).json({ error: 'Gemini вернул пустой ответ. Попробуйте отправить сообщение еще раз.' });
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Gemini endpoint error:', error);
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return res.status(504).json({ error: 'Gemini не ответил за 8 секунд. Использован локальный учебный ответ.' });
    }
    return res.status(502).json({ error: 'Не удалось подключиться к Gemini. Проверьте интернет или попробуйте позже.' });
  }
};
