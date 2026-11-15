'use strict';

const STORAGE_KEY = 'edupulse-ai-state-v1';
const STORAGE_BACKUP_KEY = 'edupulse-ai-state-v1-backup';
const PROFILE_INFO = {
  amir: { id: 'EDU-01', name: 'Амир', level: 'Базовый уровень', course: 'IELTS Reading', email: 'id01@edu-school.kz', className: '10 А' },
  alina: { id: 'EDU-02', name: 'Алина', level: 'Продвинутый уровень', course: 'IELTS Reading', email: 'id02@edu-school.kz', className: '10 А' },
  dias: { id: 'EDU-03', name: 'Диас', level: 'Базовый уровень', course: 'Алгебра', email: 'id03@edu-school.kz', className: '10 А' },
  dana: { id: 'EDU-04', name: 'Дана', level: 'Продвинутый уровень', course: 'Алгебра', email: 'id04@edu-school.kz', className: '10 А' }
};
const QUIZ_ANSWERS = { q1: 'True', q2: 'False', q3: 'Not Given' };
const DEMO_DIAGNOSTICS = {
  amir: [{ topic: 'Раскрытие скобок с минусом', missed: true }, { topic: 'Reading True/False/Not Given', missed: true }],
  alina: [{ topic: 'Раскрытие скобок с минусом', missed: false }, { topic: 'Reading True/False/Not Given', missed: false }],
  dias: [{ topic: 'Раскрытие скобок с минусом', missed: true }, { topic: 'Reading True/False/Not Given', missed: true }],
  dana: [{ topic: 'Раскрытие скобок с минусом', missed: true }, { topic: 'Reading True/False/Not Given', missed: false }]
};

const THEME_KEY = 'edupulse-theme-v1';
const API_KEY_STORAGE = 'ai_api_key';

function createStudentState(profileId) {
  const demo = {
    amir: { xp: 120, attendance: 96, progress: 35 },
    alina: { xp: 240, attendance: 100, progress: 78 },
    dias: { xp: 90, attendance: 88, progress: 42 },
    dana: { xp: 180, attendance: 94, progress: 68 }
  }[profileId];
  return {
    answers: {}, checked: false, gap: DEMO_DIAGNOSTICS[profileId].find(record => record.missed)?.topic ? `Требуется отработка темы «${DEMO_DIAGNOSTICS[profileId].find(record => record.missed).topic}».` : '', importPrompt: '', importAnswer: '',
    chat: [{ role: 'assistant', text: 'Привет! Я помогу тебе разобраться шаг за шагом. С чего хочешь начать?' }],
    path: [
      { id: 'base-1', title: 'Reading for detail', detail: 'Practice finding specific information in a short passage.', status: 'Пройдено', kind: 'done' },
      { id: 'base-2', title: 'True, False or Not Given?', detail: 'Активное упражнение · различай факт, противоречие и недостающую информацию.', status: 'Активно', kind: 'active' }
    ],
    summary: 'Пока нет результатов. Пройдите мини-тест или разберите собственное задание, чтобы увидеть персональную сводку.',
    recommendedTask: 'Прочитай короткий текст и определи, подтверждает ли он утверждение, противоречит ему или не дает достаточно информации.',
    approval: false, tutorTurns: 0, lastIssue: '', apiNotice: '', fallbackQuestionIndex: 0,
    diagnostics: DEMO_DIAGNOSTICS[profileId].map((record, index) => ({ id: `baseline-${profileId}-${index}`, ...record, gap: record.missed ? `Требуется отработка темы «${record.topic}».` : '', date: 'Стартовые данные демо-класса' })),
    progress: demo.progress, attendance: demo.attendance, tabSwitches: 0, focusModeEnabled: true, quizActive: false, focusAlert: false,
    xp: demo.xp, avatarFrame: 'none', avatarBadge: 'none', ownedCosmetics: ['none'], teacherMessages: []
  };
}

function getClassDiagnostics() {
  return Object.values(state.students).flatMap(student => student.diagnostics || []);
}

function calculateClassGaps() {
  const learners = Object.entries(state.students);
  const topics = new Map();
  learners.forEach(([studentId, student]) => {
    const latestByTopic = new Map();
    (student.diagnostics || []).forEach(record => latestByTopic.set(record.topic, record));
    latestByTopic.forEach((record, topic) => {
      const current = topics.get(topic) || { topic, affected: 0, assessed: 0, learnerNames: [] };
      current.assessed += 1;
      if (record.missed) { current.affected += 1; current.learnerNames.push(PROFILE_INFO[studentId]?.name || 'Ученик'); }
      topics.set(topic, current);
    });
  });
  return [...topics.values()].map(item => ({ ...item, percent: item.assessed ? Math.round(item.affected / item.assessed * 100) : 0 })).filter(item => item.affected).sort((a, b) => b.percent - a.percent);
}

function renderTeacher() {
  const student = activeStudent();
  const profile = PROFILE_INFO[state.profileId];
  const learners = Object.entries(state.students);
  const gaps = calculateClassGaps();
  const worstGap = gaps[0];
  const smallGroupIds = worstGap ? new Set(worstGap.learnerNames) : new Set();
  const approvedPlan = state.lessonPlan.approved;
  const lessonCard = element('classLessonCard');
  lessonCard.className = `rounded-3xl border-2 p-6 shadow-xl transition-all sm:p-8 ${approvedPlan ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-green-50' : 'border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50'}`;
  lessonCard.innerHTML = `
    <div class="flex flex-col justify-between gap-5 lg:flex-row lg:items-start"><div><div class="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-indigo-800">🎯 AI · 10 А</div><h2 class="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">AI-рекомендации по структуре следующего урока</h2><p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Рекомендации рассчитаны по последней диагностике каждого ученика класса; результаты текущего теста включаются сразу.</p></div><div class="rounded-2xl ${approvedPlan ? 'bg-emerald-100 text-emerald-900' : 'bg-white text-indigo-900'} px-4 py-3 text-sm font-bold shadow-sm">${approvedPlan ? '✓ План урока утвержден учителем' : 'Черновик · ожидает утверждения'}</div></div>
    <div class="mt-6 grid gap-5 lg:grid-cols-[1.05fr_.95fr]"><div class="rounded-2xl border border-white bg-white/90 p-5"><h3 class="text-lg font-bold text-slate-900">Пробелы класса</h3><div class="mt-4 space-y-3">${gaps.length ? gaps.slice(0, 4).map(gap => `<div><div class="flex items-start justify-between gap-3"><span class="text-sm font-semibold text-slate-700">${escapeHTML(gap.topic)}</span><b class="shrink-0 text-sm text-rose-700">${gap.percent}% · ${gap.affected}/${gap.assessed}</b></div><div class="mt-2 h-2.5 rounded-full bg-slate-100"><div class="h-2.5 rounded-full bg-rose-500" style="width:${gap.percent}%"></div></div></div>`).join('') : '<p class="text-sm text-slate-500">Пробелы не выявлены: продолжайте усложнять задания.</p>'}</div></div>
      <div class="rounded-2xl border border-white bg-white/90 p-5"><h3 class="text-lg font-bold text-slate-900">План урока · 45 минут</h3><div class="mt-3 space-y-3 text-sm leading-6 text-slate-700"><p><b>15 мин · Общий разбор у доски:</b> ${escapeHTML(worstGap ? worstGap.topic : 'повтор ключевого навыка')} — разберите типичную ошибку на контрастных примерах.</p><p><b>18 мин · Мини-группа:</b> ${escapeHTML(worstGap?.learnerNames.join(', ') || 'ученики с выявленным пробелом')} — базовая пошаговая отработка с обратной связью.</p><p><b>12 мин · Продвинутые карточки:</b> ${escapeHTML(learners.filter(([id]) => !smallGroupIds.has(PROFILE_INFO[id].name)).map(([, item]) => item.name).join(', ') || 'остальной класс')} — перенос навыка на новые контексты.</p>${state.lessonPlan.advice ? `<p class="rounded-xl bg-indigo-50 p-3 text-indigo-900"><b>Совет AI:</b> ${escapeHTML(state.lessonPlan.advice)}</p>` : ''}</div></div></div>
    <div class="mt-5 flex flex-wrap items-center justify-between gap-3"><span class="text-xs text-slate-500">${learners.length} ученика · данные объединены из актуальных профилей 10 А</span><button id="approveLessonPlanBtn" type="button" ${approvedPlan ? 'disabled' : ''} class="rounded-xl ${approvedPlan ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'} px-5 py-3 text-sm font-bold text-white transition">${approvedPlan ? '✓ План утвержден' : '✅ Утвердить план урока'}</button></div>`;
  element('classRosterCount').textContent = `${learners.length} ученика`;
  element('classRoster').innerHTML = learners.map(([id, record]) => {
    const info = PROFILE_INFO[id];
    const frame = record.avatarFrame === 'frame-sky' ? 'ring-2 ring-sky-400' : record.avatarFrame === 'frame-amber' ? 'ring-2 ring-amber-400' : '';
    const badge = record.avatarBadge === 'badge-reader' ? '📚' : record.avatarBadge === 'badge-streak' ? '🔥' : '';
    return `<button type="button" data-student-profile="${id}" class="rounded-2xl border ${state.profileId === id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'} p-4 text-left shadow-sm transition"><div class="flex items-center gap-3"><span class="grid h-11 w-11 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-800 ${frame}">${info.id.slice(-2)}</span><div class="min-w-0"><div class="truncate font-bold text-slate-900">${escapeHTML(info.name)} ${badge}</div><div class="text-[11px] text-slate-500">${escapeHTML(info.email)} · ${escapeHTML(info.level)}</div></div></div><div class="mt-4 grid grid-cols-3 gap-2 text-center"><div class="rounded-lg bg-slate-50 p-2"><b class="block text-sm text-indigo-700">${record.progress}%</b><span class="text-[10px] text-slate-400">прогресс</span></div><div class="rounded-lg bg-slate-50 p-2"><b class="block text-sm text-amber-700">${record.xp}</b><span class="text-[10px] text-slate-400">XP</span></div><div class="rounded-lg bg-slate-50 p-2"><b class="block text-sm text-sky-700">${record.tabSwitches}</b><span class="text-[10px] text-slate-400">вкладки</span></div></div><p class="mt-3 line-clamp-2 min-h-8 text-xs leading-4 text-slate-600">${escapeHTML(record.gap || record.lastIssue || 'Пробел не выявлен')}</p><div class="mt-2 flex justify-between text-[10px] text-slate-400"><span>Посещаемость ${record.attendance}%</span><span>${record.path.filter(task => task.kind === 'ai' && !task.teacherApproved).length} маршрут(а) на одобрении</span></div></button>`;
  }).join('');
  element('teacherStudentCard').innerHTML = `
    <div class="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><div class="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">${profile.id.slice(-2)}</div><div><div class="font-bold text-slate-900">${profile.name} <span class="font-medium text-slate-400">· ${profile.id}</span></div><div class="mt-1 text-xs text-slate-500">${profile.level} · ${profile.course} · ${escapeHTML(profile.email)}</div></div></div>
    <div class="mt-4 grid grid-cols-2 gap-3"><div class="rounded-xl border border-slate-100 p-3"><div class="text-xs text-slate-400">Диагностика</div><div class="mt-1 text-sm font-semibold text-slate-800">${student.checked || student.lastIssue ? 'Пройдена' : 'Не начата'} · ${student.progress}%</div></div><div class="rounded-xl border border-slate-100 p-3"><div class="text-xs text-slate-400">Фокус теста</div><div class="mt-1 text-sm font-semibold text-slate-800">${student.tabSwitches} переключений · ${student.xp} XP</div></div><div class="rounded-xl border border-slate-100 p-3"><div class="text-xs text-slate-400">Посещаемость</div><div class="mt-1 text-sm font-semibold text-emerald-700">${student.attendance}%</div></div><div class="rounded-xl border border-slate-100 p-3"><div class="text-xs text-slate-400">Ответы тьютору</div><div class="mt-1 text-sm font-semibold text-slate-800">${student.tutorTurns}</div></div></div>`;
  element('teacherFeedback').innerHTML = `
    <div class="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><div class="text-xs font-bold uppercase tracking-wide text-slate-400">Сводка AI</div><p class="mt-2 text-sm leading-6 text-slate-700">${escapeHTML(student.summary)}</p></div>
    <div class="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4"><div class="text-xs font-bold uppercase tracking-wide text-amber-800">Рекомендуемая тема</div><p class="mt-1.5 text-sm leading-6 text-amber-950">${escapeHTML(student.gap || student.lastIssue || 'Пройдите мини-тест, чтобы определить следующую область для практики.')}</p></div>
    <div class="mt-3 text-xs text-slate-500">Диалог с тьютором: ${student.tutorTurns ? `${student.tutorTurns} ответ(а) ученика` : 'пока не начат'}</div>`;
  const pendingTasks = student.path.filter(task => task.kind === 'ai' && !task.teacherApproved);
  element('recommendationPanel').innerHTML = `
    <div class="space-y-3">${pendingTasks.length ? pendingTasks.map(task => `<article class="rounded-xl border border-amber-200 bg-amber-50/60 p-4"><div class="flex flex-wrap items-center justify-between gap-2"><b class="text-sm text-slate-900">${escapeHTML(task.title)} · ${escapeHTML(task.difficulty || 'Персональное')}</b><span class="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">Ожидает одобрения учителя</span></div><p class="mt-2 text-sm leading-5 text-slate-600">${escapeHTML(task.detail)}</p><button type="button" data-approve-task="${escapeHTML(task.id)}" class="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">✓ Одобрить задание</button></article>`).join('') : '<p class="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Нет персональных заданий, ожидающих одобрения.</p>'}</div>
    <label for="recommendationInput" class="mb-2 mt-4 block text-sm font-semibold text-slate-700">Рекомендация для маршрута</label>
    <textarea id="recommendationInput" rows="3" class="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50">${escapeHTML(student.recommendedTask)}</textarea>
    <div class="mt-4 flex flex-wrap items-center justify-between gap-3"><span class="text-xs ${student.approval ? 'font-semibold text-emerald-700' : 'text-slate-400'}">${student.approval ? '✓ Одобрено учителем' : 'Ожидает проверки учителя'}</span><button id="approveBtn" type="button" class="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700">✅ Добавить и одобрить рекомендацию</button></div>`;
  element('teacherMessageStudent').textContent = `${profile.name} · ${profile.email}`;
  element('teacherMessageThread').innerHTML = student.teacherMessages.length ? student.teacherMessages.map(message => `<div class="flex ${message.from === 'student' ? 'justify-start' : 'justify-end'}"><div class="max-w-[85%] rounded-xl ${message.from === 'student' ? 'bg-white text-slate-700' : 'bg-indigo-600 text-white'} px-3 py-2.5 text-sm"><div class="mb-1 text-[10px] font-bold uppercase opacity-70">${message.from === 'student' ? 'Ученик' : 'Учитель'} · ${escapeHTML(message.time)}</div>${escapeHTML(message.text)}</div></div>`).join('') : '<p class="text-xs text-slate-400">Сообщений пока нет.</p>';
}

function createInitialState() {
  const students = Object.fromEntries(Object.keys(PROFILE_INFO).map(id => [id, createStudentState(id)]));
  return {
    role: 'student', profileId: 'amir', tab: 'quiz', studentSection: 'diagnostic', students,
    lessonPlan: { status: 'Черновик', approved: false, summary: 'План будет рассчитан по диагностическим данным учеников 10 «А».', advice: '', agenda: [] }
  };
}

function loadState() {
  try {
    let stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { JSON.parse(stored); }
      catch { stored = localStorage.getItem(STORAGE_BACKUP_KEY); }
    }
    if (!stored) return createInitialState();
    const saved = JSON.parse(stored);
    const initial = createInitialState();
    const students = {};
    for (const id of Object.keys(PROFILE_INFO)) {
      const savedStudent = saved.students?.[id];
      const merged = { ...initial.students[id], ...(savedStudent && typeof savedStudent === 'object' ? savedStudent : {}) };
      for (const key of ['answers', 'chat', 'path', 'diagnostics', 'ownedCosmetics', 'teacherMessages']) {
        if (!Array.isArray(merged[key])) merged[key] = initial.students[id][key];
      }
      students[id] = merged;
    }
    return {
      ...initial,
      ...saved,
      students,
      lessonPlan: { ...initial.lessonPlan, ...(saved.lessonPlan || {}) },
      profileId: PROFILE_INFO[saved.profileId] ? saved.profileId : 'amir',
      role: saved.role === 'teacher' ? 'teacher' : 'student',
      tab: saved.tab === 'import' ? 'import' : 'quiz',
      studentSection: saved.studentSection === 'path' ? 'path' : 'diagnostic'
    };
  } catch (error) {
    console.warn('EduPulse could not read saved state; keeping the app available:', String(error));
    return createInitialState();
  }
}

let state = loadState();
let currentTheme = (() => { try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } })();
let working = false;
const activeStudent = () => state.students[state.profileId];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const element = id => document.getElementById(id);

function persist() {
  try {
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous) localStorage.setItem(STORAGE_BACKUP_KEY, previous);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  catch (error) { console.warn('EduPulse could not save browser state:', String(error)); }
}

function readApiKey() {
  try { return localStorage.getItem(API_KEY_STORAGE) || ''; }
  catch { return ''; }
}

async function requestGroqDirect(messages, context, mode, apiKey) {
  const systemPrompt = 'Ты — учебный AI-тьютор в режиме Сократа. Верни только JSON с ключами gap, personal_tasks, lesson_focus_advice, tutor_hint, tutor_reply. В tutor_reply ответь именно на последнее сообщение ученика, конкретно и кратко, не выдавай готовое решение, а задай наводящий вопрос. В personal_tasks включи два задания разной сложности по пробелу.';
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'system', content: `Режим: ${mode}. Контекст задачи: ${context}` }, ...messages],
      temperature: 0.4,
      max_tokens: 700,
      response_format: { type: 'json_object' }
    }),
    signal: AbortSignal.timeout(25000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Groq HTTP ${response.status}`);
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned an empty response.');
  return JSON.parse(content);
}

function updateView() {
  const studentMode = state.role === 'student';
  const profile = PROFILE_INFO[state.profileId];
  element('studentView').classList.toggle('hidden', !studentMode);
  element('teacherView').classList.toggle('hidden', studentMode);
  element('studentSelect').value = state.profileId;
  document.documentElement.classList.toggle('dark', currentTheme === 'dark');
  document.documentElement.dataset.theme = currentTheme;
  element('themeToggle').textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  element('pageSubtitle').textContent = studentMode
    ? `Практикуйся, задавай вопросы и двигайся вперёд в собственном темпе. ${profile.id} · ${profile.level}`
    : `Прогресс профиля ${profile.id}: обратная связь AI, диалог с тьютором и следующий рекомендуемый шаг.`;
  element('aiModeLabel').textContent = 'AI Tutor · Vercel serverless';
  element('quizTab').className = `flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold sm:text-sm ${state.tab === 'quiz' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`;
  element('importTab').className = `flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold sm:text-sm ${state.tab === 'import' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`;
  element('studentRoleBtn').className = `rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm ${studentMode ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`;
  element('teacherRoleBtn').className = `rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm ${!studentMode ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'}`;
  const pendingCount = activeStudent().path.filter(task => task.kind === 'ai' && !task.teacherApproved).length;
  element('pendingTaskCount').textContent = pendingCount || '';
  element('diagnosticSection').classList.toggle('hidden', state.studentSection !== 'diagnostic');
  element('learningPathSection').classList.toggle('hidden', state.studentSection !== 'path');
  element('studentDiagnosticTab').className = `flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${state.studentSection === 'diagnostic' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`;
  element('studentPathTab').className = `flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${state.studentSection === 'path' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`;
  renderStudentStats();
  renderDiagnostic();
  renderLearningPath();
  renderCosmeticShop();
  renderChat();
  renderStudentTeacherMessages();
  renderTeacher();
}

function renderStudentStats() {
  const student = activeStudent();
  const profile = PROFILE_INFO[state.profileId];
  const frameClass = student.avatarFrame === 'frame-sky' ? 'ring-4 ring-sky-300' : student.avatarFrame === 'frame-amber' ? 'ring-4 ring-amber-300' : 'ring-2 ring-indigo-100';
  const badge = student.avatarBadge === 'badge-reader' ? '📚 Читатель' : student.avatarBadge === 'badge-streak' ? '🔥 Серия' : 'Ученик';
  element('studentStats').innerHTML = `
    <article class="flex min-h-[68px] items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700 ${frameClass}">${profile.id.slice(-2)}</div><div class="min-w-0 flex-1"><div class="truncate text-[10px] text-slate-400">${escapeHTML(profile.email)}</div><h2 class="truncate text-sm font-bold text-slate-900 dark:text-slate-100">${escapeHTML(profile.name)} <span class="text-[10px] font-medium text-slate-400">${escapeHTML(badge)}</span></h2></div><button id="openAvatarModal" type="button" class="shrink-0 rounded-lg bg-violet-50 px-2 py-1.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">🎨 Аватар (XP)</button></article>
    <article class="flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div class="text-xl font-bold text-indigo-600">${student.progress}%</div><div class="min-w-0 flex-1"><div class="text-[10px] font-semibold uppercase text-slate-400">Прогресс</div><div class="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-1.5 rounded-full bg-indigo-500" style="width:${Math.min(100, student.progress)}%"></div></div></div></article>
    <article class="flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div class="text-xl font-bold text-emerald-600">${student.attendance}%</div><div><div class="text-[10px] font-semibold uppercase text-slate-400">Посещаемость</div><div class="text-[10px] text-slate-500 dark:text-slate-400">Баланс <b class="text-amber-600">${student.xp} XP</b></div></div></article>
    <article class="flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div class="text-xl font-bold text-slate-900 dark:text-slate-100">${student.tabSwitches}</div><div><div class="text-[10px] font-semibold uppercase text-slate-400">Фокус теста</div><div class="text-[10px] text-slate-500 dark:text-slate-400">переключений вкладки</div></div></article>`;
  element('focusModeLabel').textContent = student.focusModeEnabled ? 'Включен: переключения вкладок фиксируются во время теста.' : 'Выключен: тест не отслеживает переключения вкладок.';
  element('focusModeBtn').textContent = student.focusModeEnabled ? 'Лок-скрин включен' : 'Включить лок-скрин';
  element('tabSwitchCount').textContent = `${student.tabSwitches} переключений`;
  element('focusAlert').classList.toggle('hidden', !student.focusAlert);
  element('focusAlertText').textContent = `Зафиксировано переключение вкладки. Всего: ${student.tabSwitches}.`;
}

function renderDiagnostic() {
  const student = activeStudent();
  const panel = element('diagnosticPanel');
  if (state.tab === 'import') {
    panel.innerHTML = `
      <form id="importForm" class="space-y-4">
        <div><label for="importPrompt" class="mb-2 block text-sm font-semibold text-slate-700">Текст задачи или вопроса со стороннего сайта</label><textarea id="importPrompt" rows="5" required placeholder="Вставьте условие задачи или вопрос…" class="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50">${escapeHTML(student.importPrompt)}</textarea></div>
        <div><label for="importAnswer" class="mb-2 block text-sm font-semibold text-slate-700">Мой ответ</label><textarea id="importAnswer" rows="3" required placeholder="Опишите свой ответ и ход мысли…" class="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50">${escapeHTML(student.importAnswer)}</textarea></div>
        <button type="submit" ${working ? 'disabled' : ''} class="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700">${working ? 'AI анализирует…' : '✦ Разобрать с AI'}</button>
      </form>`;
    return;
  }

  const questions = [
    ['q1', 'The library opens at 9 a.m. on weekdays.'],
    ['q2', 'The library is open every Sunday.'],
    ['q3', 'The library has a café.']
  ];
  panel.innerHTML = `
    <div class="flex min-h-full flex-col">
      <div class="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:bg-slate-800 dark:text-slate-200"><span class="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Reading passage</span>The Greenfield Library opens at 9 a.m. from Monday to Friday. On Saturdays, visitors can use the study rooms until 4 p.m. The library is closed on Sundays. Members can borrow up to five books at a time.</div>
      <div class="mt-3"><button id="demoAnswersBtn" type="button" class="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-semibold text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300">⚡ Заполнить демо-ответы (с 1 ошибкой)</button></div>
      <form id="quizForm" class="mt-5 flex flex-1 flex-col gap-5">
        <div class="flex items-center justify-between"><h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">IELTS Reading · True / False / Not Given</h3><span class="text-xs text-slate-400">3 утверждения</span></div>
        <div class="grid flex-1 content-between gap-5 lg:gap-7">
        ${questions.map(([id, statement]) => {
        const selected = student.answers[id] || '';
        const result = student.checked ? (QUIZ_ANSWERS[id] === selected ? 'correct' : 'incorrect') : '';
        return `<fieldset class="rounded-xl border border-slate-200 p-4 dark:border-slate-700 ${result === 'incorrect' ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/40' : 'bg-white dark:bg-slate-900'}"><legend class="mb-3 text-sm font-medium leading-6 text-slate-800 dark:text-slate-100">${id.slice(1)}. ${escapeHTML(statement)}</legend><div class="grid grid-cols-3 gap-2">${['True', 'False', 'Not Given'].map(option => `<label class="choice flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"><input type="radio" name="${id}" value="${option}" ${selected === option ? 'checked' : ''}><span>${option}</span></label>`).join('')}</div>${result === 'incorrect' ? '<p class="mt-2 text-xs font-semibold text-rose-700">Неверно. Проверь: утверждение противоречит тексту или информации недостаточно?</p>' : result === 'correct' ? '<p class="mt-2 text-xs font-semibold text-emerald-700">Верно</p>' : ''}</fieldset>`;
      }).join('')}
        </div>
        <div class="mt-auto space-y-3"><button type="submit" ${working ? 'disabled' : ''} class="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700">${working ? 'AI анализирует…' : 'Проверить ответы'}</button>
        ${student.checked ? `<div class="rounded-xl border ${student.gap ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'} p-3.5 text-sm"><b>${student.gap ? 'Пробел выявлен' : 'Отличная работа!'}</b> ${escapeHTML(student.gap || 'Все три ответа верны. Продолжай в том же духе!')}</div>` : ''}</div>
      </form>
    </div>`;
}

function renderLearningPath() {
  const path = activeStudent().path;
  element('learningPath').innerHTML = path.map((task, index) => `
    <div class="relative flex gap-4 pb-5 last:pb-0">
      <div class="relative flex w-6 shrink-0 justify-center"><span class="z-10 mt-1 grid h-6 w-6 place-items-center rounded-full ${task.kind === 'done' ? 'bg-emerald-100 text-emerald-700' : task.kind === 'active' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'} text-xs font-bold">${task.kind === 'done' ? '✓' : task.kind === 'active' ? '•' : '✦'}</span>${index < path.length - 1 ? '<span class="absolute top-7 h-full w-px bg-slate-200"></span>' : ''}</div>
      <div class="min-w-0 flex-1 rounded-xl border border-slate-200 p-3.5 ${task.kind === 'active' ? 'bg-indigo-50/40' : 'bg-white'}"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="text-sm font-semibold text-slate-800">${escapeHTML(task.title)}</h3><span class="rounded-full px-2.5 py-1 text-[10px] font-bold ${task.teacherApproved ? 'bg-emerald-100 text-emerald-800' : task.kind === 'ai' ? 'bg-amber-50 text-amber-800' : task.kind === 'done' ? 'bg-emerald-50 text-emerald-700' : task.kind === 'active' ? 'bg-indigo-50 text-indigo-700' : 'bg-violet-50 text-violet-700'}">${task.kind === 'ai' ? (task.teacherApproved ? '✓ Одобрено учителем' : 'Ожидает одобрения учителя') : escapeHTML(task.status)}</span></div><p class="mt-1 text-xs leading-5 text-slate-500">${escapeHTML(task.detail)}</p>${task.difficulty ? `<span class="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">Уровень: ${escapeHTML(task.difficulty)}</span>` : ''}</div>
    </div>`).join('');
}

const COSMETICS = [
  { id: 'frame-sky', title: 'Голубая рамка', type: 'frame', cost: 80, icon: '🔵' },
  { id: 'frame-amber', title: 'Золотая рамка', type: 'frame', cost: 120, icon: '🟡' },
  { id: 'badge-reader', title: 'Бейдж «Читатель»', type: 'badge', cost: 60, icon: '📚' },
  { id: 'badge-streak', title: 'Бейдж «Серия»', type: 'badge', cost: 100, icon: '🔥' }
];

function renderCosmeticShop() {
  const student = activeStudent();
  element('shopBalance').textContent = `Доступно ${student.xp} XP · украшения отображаются в профиле и списке класса.`;
  element('cosmeticShop').innerHTML = COSMETICS.map(item => {
    const owned = student.ownedCosmetics.includes(item.id);
    const equipped = item.type === 'frame' ? student.avatarFrame === item.id : student.avatarBadge === item.id;
    const label = equipped ? 'Снять' : owned ? 'Надеть' : `Купить · ${item.cost} XP`;
    return `<article class="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"><div><div class="text-sm font-semibold text-slate-800">${item.icon} ${escapeHTML(item.title)}</div><div class="mt-1 text-[11px] text-slate-400">${owned ? (equipped ? 'Надето' : 'Уже куплено') : 'Можно купить за XP'}</div></div><button type="button" data-cosmetic-id="${item.id}" class="shrink-0 rounded-lg ${owned ? 'border border-slate-200 bg-white text-slate-700' : 'bg-indigo-600 text-white'} px-3 py-2 text-xs font-semibold">${label}</button></article>`;
  }).join('');
}

function renderStudentTeacherMessages() {
  const messages = activeStudent().teacherMessages;
  element('studentTeacherMessages').innerHTML = messages.length ? messages.map(message => `
    <div class="flex ${message.from === 'student' ? 'justify-end' : 'justify-start'}"><div class="max-w-[85%] rounded-xl ${message.from === 'student' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'} px-3 py-2.5 text-sm"><div class="mb-1 text-[10px] font-bold uppercase opacity-70">${message.from === 'student' ? 'Вы' : 'Учитель'} · ${escapeHTML(message.time)}</div>${escapeHTML(message.text)}</div></div>`).join('') : '<p class="rounded-lg bg-slate-50 p-3 text-xs text-slate-400">Сообщений пока нет. Здесь появятся сообщения ученика и ответы учителя.</p>';
}

function renderChat() {
  const student = activeStudent();
  const notice = element('aiErrorNotice');
  notice.textContent = student.apiNotice || '';
  notice.classList.toggle('hidden', !student.apiNotice);
  element('chatMessages').innerHTML = student.chat.map(message => `
    <div class="flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}"><div class="max-w-[88%] rounded-2xl ${message.role === 'user' ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100'} px-4 py-3 text-sm leading-6"><div class="mb-1 text-[10px] font-bold uppercase tracking-wide ${message.role === 'user' ? 'text-indigo-100' : 'text-slate-400'}">${message.role === 'user' ? 'Ученик' : 'AI Tutor'}</div>${escapeHTML(message.text).replace(/\n/g, '<br>')}</div></div>`).join('');
  const container = element('chatMessages');
  container.scrollTop = container.scrollHeight;
}

function renderChatWorking() {
  const container = element('chatMessages');
  const existing = element('chatWorkingIndicator');
  if (existing) existing.remove();
  if (!working) return;
  container.insertAdjacentHTML('beforeend', '<div id="chatWorkingIndicator" class="flex justify-start"><div class="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-300">AI Tutor печатает…</div></div>');
  container.scrollTop = container.scrollHeight;
}

function renderTeacher() {
  const student = activeStudent();
  const profile = PROFILE_INFO[state.profileId];
  element('teacherStudentCard').innerHTML = `
    <div class="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><div class="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">${profile.id.slice(-2)}</div><div><div class="font-bold text-slate-900">${profile.name} <span class="font-medium text-slate-400">· ${profile.id}</span></div><div class="mt-1 text-xs text-slate-500">${profile.level} · ${profile.course}</div></div></div>
    <div class="mt-4 grid grid-cols-2 gap-3"><div class="rounded-xl border border-slate-100 p-3"><div class="text-xs text-slate-400">Диагностика</div><div class="mt-1 text-sm font-semibold text-slate-800">${student.checked || student.lastIssue ? 'Пройдена' : 'Не начата'}</div></div><div class="rounded-xl border border-slate-100 p-3"><div class="text-xs text-slate-400">Ответы тьютору</div><div class="mt-1 text-sm font-semibold text-slate-800">${student.tutorTurns}</div></div></div>`;
  element('teacherFeedback').innerHTML = `
    <div class="rounded-xl border border-slate-100 bg-slate-50/70 p-4"><div class="text-xs font-bold uppercase tracking-wide text-slate-400">Сводка AI</div><p class="mt-2 text-sm leading-6 text-slate-700">${escapeHTML(student.summary)}</p></div>
    <div class="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 p-4"><div class="text-xs font-bold uppercase tracking-wide text-amber-800">Рекомендуемая тема</div><p class="mt-1.5 text-sm leading-6 text-amber-950">${escapeHTML(student.gap || student.lastIssue || 'Пройдите мини-тест, чтобы определить следующую область для практики.')}</p></div>
    <div class="mt-3 text-xs text-slate-500">Диалог с тьютором: ${student.tutorTurns ? `${student.tutorTurns} ответ(а) ученика` : 'пока не начат'}</div>`;
  element('recommendationPanel').innerHTML = `
    <label for="recommendationInput" class="mb-2 block text-sm font-semibold text-slate-700">Рекомендованная AI задача для маршрута</label>
    <textarea id="recommendationInput" rows="3" class="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50">${escapeHTML(student.recommendedTask)}</textarea>
    <div class="mt-4 flex flex-wrap items-center justify-between gap-3"><span class="text-xs ${student.approval ? 'font-semibold text-emerald-700' : 'text-slate-400'}">${student.approval ? '✓ Одобрено учителем' : 'Ожидает проверки учителя'}</span><button id="approveBtn" type="button" class="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700">✅ Одобрить маршрут AI</button></div>`;
}

function saveAndRender() { persist(); updateView(); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

const FALLBACK_PROMPTS = [
  'Какое слово или предложение в условии поможет проверить твою мысль?',
  'Сравни свой ответ с текстом: что именно подтверждает его?',
  'Какой следующий небольшой шаг ты бы сделал, чтобы разобраться?',
  'В условии есть прямое подтверждение, противоречие или информации пока не хватает?',
  'Попробуй объяснить свой выбор одной фразой со ссылкой на условие.'
];

function getTaskContext(student) {
  const task = state.tab === 'import' && student.importPrompt.trim()
    ? `Импортированное задание: ${student.importPrompt}. Ответ ученика: ${student.importAnswer || 'еще не указан'}.`
    : 'Тест IELTS Reading. Текст: Greenfield Library opens at 9 a.m. from Monday to Friday. On Saturdays, visitors can use study rooms until 4 p.m. The library is closed on Sundays. Members can borrow up to five books. Утверждения: q1 — opens at 9 on weekdays; q2 — open every Sunday; q3 — has a café.';
  const answers = Object.entries(student.answers).map(([id, answer]) => `${id}: ${answer}`).join('; ');
  return [task, answers ? `Ответы в мини-тесте: ${answers}.` : '', student.gap ? `Выявленный пробел: ${student.gap}.` : '', student.lastIssue ? `Последняя ошибка: ${student.lastIssue}.` : ''].filter(Boolean).join('\n');
}

function isRequestForAnswer(text) {
  return /(?:готов(?:ый|ого)\s+ответ|дай\s+(?:мне\s+)?ответ|скажи\s+(?:мне\s+)?ответ|реши\s+за\s+меня|просто\s+ответ|just\s+(?:give|tell)|give\s+me\s+the\s+answer|answer\s+only)/i.test(text);
}

function isNonsense(text) {
  const normalized = text.trim().toLowerCase();
  return normalized.length < 3 || /^[\d\W_]+$/u.test(normalized) || /^(фыв|ыва|asdf|qwer|йцук|лол)$/iu.test(normalized);
}

function buildFallback(promptData, student, history) {
  const gap = promptData.diagnosticGap || student.gap || 'Сверь ответ с конкретными словами в условии.';
  const latestUserMessage = [...history].reverse().find(message => message.role === 'user')?.text || promptData.studentAnswer || '';
  let tutorReply;

  if (promptData.mode === 'tutor' && isNonsense(latestUserMessage)) {
    tutorReply = `Давай вернёмся к заданию: ${gap} Какой факт из текста помогает обосновать твой ответ?`;
  } else if (promptData.mode === 'tutor' && isRequestForAnswer(latestUserMessage)) {
    tutorReply = `Я не дам готовый ответ, но помогу найти его самому. ${gap} Какое предложение из условия нужно проверить первым?`;
  } else if (promptData.mode === 'diagnostic') {
    tutorReply = `Посмотрим на твой выбор: ${gap} Какие слова в тексте подсказывают, верно ли ты определил ответ?`;
  } else if (promptData.mode === 'import') {
    tutorReply = `Начнем с условия: ${gap} Какой его фрагмент лучше всего подтверждает твою мысль?`;
  } else {
    const index = student.fallbackQuestionIndex % FALLBACK_PROMPTS.length;
    student.fallbackQuestionIndex += 1;
    tutorReply = `${gap} ${FALLBACK_PROMPTS[index]}`;
  }

  return {
    gap,
    tutor_reply: tutorReply,
    next_task: `Тренировка: ${gap} Найди подтверждающие слова в новом коротком условии и объясни свой выбор одним предложением.`,
    personal_tasks: [
      { title: 'Базовая отработка', difficulty: 'Базовый', description: `Выполни короткое упражнение по теме «${promptData.topic || gap}»: найди ключевые данные и объясни один шаг.` },
      { title: 'Перенос навыка', difficulty: 'Продвинутый', description: `Реши усложнённую задачу по теме «${promptData.topic || gap}» и обоснуй выбор, опираясь на условие.` }
    ],
    lesson_focus_advice: `На уроке по теме «${promptData.topic || 'текущая тема'}» покажите контрастный пример и попросите ученика проговорить, какие данные определяют следующий шаг.`,
    tutor_hint: tutorReply,
    teacher_summary: `Ученик работал с темой «${promptData.topic || 'понимание условия'}». Наблюдаемый пробел: ${gap} Тьютор помогает рассуждать самостоятельно, опираясь на текст.`
  };
}

function setApiNotice(profileId, message) {
  state.students[profileId].apiNotice = message;
  if (state.profileId === profileId) renderChat();
}

async function callAI(promptData, profileId) {
  const student = state.students[profileId];
  const history = student.chat.map(message => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: String(message.text || '') }));
  const fallback = buildFallback(promptData, student, student.chat);
  try {
    const apiKey = readApiKey();
    const requestBody = JSON.stringify({ messages: history, context: `${getTaskContext(student)}\n${JSON.stringify(promptData)}`, apiKey, mode: promptData.mode || 'tutor' });
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
      signal: AbortSignal.timeout(20000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${payload.error || `HTTP ${response.status}`}${payload.details ? ` — ${payload.details}` : ''}`);
    const reply = payload.reply?.trim();
    if (!reply && !payload.gap) throw new Error('Groq API вернул пустой ответ.');
    student.apiNotice = '';
    return {
      gap: payload.gap || fallback.gap,
      personal_tasks: Array.isArray(payload.personal_tasks) && payload.personal_tasks.length === 2 ? payload.personal_tasks : fallback.personal_tasks,
      lesson_focus_advice: payload.lesson_focus_advice || fallback.lesson_focus_advice,
      tutor_hint: payload.tutor_hint || fallback.tutor_hint,
      diagnostic_gap: student.gap || fallback.diagnostic_gap,
      tutor_reply: reply || payload.tutor_hint || fallback.tutor_reply,
      next_task: fallback.next_task,
      teacher_summary: student.summary || payload.lesson_focus_advice || fallback.teacher_summary
    };
  } catch (error) {
    const apiKey = readApiKey();
    if (apiKey) {
      try {
        const direct = await requestGroqDirect(history, `${getTaskContext(student)}\n${JSON.stringify(promptData)}`, promptData.mode || 'tutor', apiKey);
        student.apiNotice = 'Используется прямое соединение с Groq для локального демо. Для публикации настройте серверный GROQ_API_KEY.';
        return {
          gap: direct.gap || fallback.gap,
          diagnostic_gap: direct.gap || fallback.diagnostic_gap,
          personal_tasks: Array.isArray(direct.personal_tasks) && direct.personal_tasks.length >= 2 ? direct.personal_tasks.slice(0, 2) : fallback.personal_tasks,
          lesson_focus_advice: direct.lesson_focus_advice || fallback.lesson_focus_advice,
          tutor_hint: direct.tutor_hint || fallback.tutor_hint,
          tutor_reply: direct.tutor_reply || direct.tutor_hint || fallback.tutor_reply,
          teacher_summary: direct.lesson_focus_advice || fallback.teacher_summary,
          next_task: fallback.next_task
        };
      } catch (directError) {
        error = directError;
      }
    }
    const reason = String(error.name) === 'AbortError' || String(error.name) === 'TimeoutError'
      ? 'AI не ответил вовремя. Повторите попытку; локальная подсказка доступна.'
      : `Не удалось связаться с /api/chat. Запустите проект через Vercel Dev или настройте серверный GROQ_API_KEY. ${String(error.message || error)} — включен демо-режим.`;
    console.error('Ошибка AI Tutor:', error);
    setApiNotice(profileId, reason);
    await delay(1000);
    return fallback;
  }
}

function appendAIPractice(student, result) {
  const gap = result.gap || result.diagnostic_gap || student.gap;
  const tasks = Array.isArray(result.personal_tasks) ? result.personal_tasks : [
    { title: 'Базовая отработка', difficulty: 'Базовый', description: `Разбери один пример по теме: ${gap}. Отметь шаг, где меняется знак или смысл условия.` },
    { title: 'Применение в задаче', difficulty: 'Продвинутый', description: `Реши составную задачу по теме «${gap}» и обоснуй каждый шаг.` }
  ];
  student.recommendedTask = tasks[0]?.description || tasks[0]?.task || gap;
  student.approval = false;
  student.path = student.path.filter(task => task.kind !== 'ai' || task.teacherApproved);
  tasks.slice(0, 2).forEach((task, index) => student.path.push({
    id: `ai-${Date.now()}-${index}`,
    title: task.title || (index === 0 ? 'Базовая отработка' : 'Задание повышенной сложности'),
    detail: task.description || task.task || String(task),
    difficulty: task.difficulty || (index === 0 ? 'Базовый' : 'Продвинутый'),
    status: 'Ожидает одобрения учителя',
    kind: 'ai',
    teacherApproved: false
  }));
}

function saveDiagnostic(profileId, topic, missed, gap, xpAward) {
  const student = state.students[profileId];
  const record = { id: `assessment-${Date.now()}`, topic, missed, gap, date: new Date().toLocaleDateString('ru-RU'), source: 'Текущая диагностика' };
  const prior = student.diagnostics.findIndex(item => item.topic === topic && item.id.startsWith('baseline-'));
  if (prior >= 0) student.diagnostics.splice(prior, 1);
  student.diagnostics.push(record);
  student.gap = gap;
  student.lastIssue = gap;
  student.progress = Math.min(100, student.progress + 15);
  student.xp += xpAward;
  student.quizActive = false;
  student.focusAlert = false;
  return record;
}

function inferImportedTopic(prompt) {
  if (/скоб|минус|алгебр|уравнен/i.test(prompt)) return 'Раскрытие скобок с минусом';
  if (/true|false|not given|reading|чтени/i.test(prompt)) return 'Reading True/False/Not Given';
  return `Импортированное задание: ${prompt.trim().slice(0, 48) || 'новая тема'}`;
}

async function analyzeAndGuide(profileId, promptData, { addTask = true, addTutorMessage = false } = {}) {
  const result = await callAI(promptData, profileId);
  const student = state.students[profileId];
  const gap = result.gap || result.diagnostic_gap || student.gap;
  student.gap = gap;
  student.lastIssue = gap;
  student.summary = result.teacher_summary || result.lesson_focus_advice || student.summary;
  student.lessonFocusAdvice = result.lesson_focus_advice || student.lessonFocusAdvice || '';
  student.tutorHint = result.tutor_hint || result.tutor_reply || '';
  if (student.lessonFocusAdvice) state.lessonPlan.advice = student.lessonFocusAdvice;
  const latestDiagnostic = student.diagnostics.at(-1);
  if (latestDiagnostic) { latestDiagnostic.gap = gap; latestDiagnostic.missed = Boolean(gap && !/ошибок не выявлено|пробелов не выявлено|no gap/i.test(gap)); }
  if (addTask) appendAIPractice(student, result);
  if (addTutorMessage) student.chat.push({ role: 'assistant', text: student.tutorHint || 'Какой шаг решения кажется тебе самым сложным и почему?' });
  working = false;
  persist();
  if (state.profileId === profileId) updateView();
}

element('studentRoleBtn').addEventListener('click', () => { state.role = 'student'; saveAndRender(); });
element('teacherRoleBtn').addEventListener('click', () => { state.role = 'teacher'; saveAndRender(); });
element('studentSelect').addEventListener('change', event => { state.profileId = event.target.value; saveAndRender(); });
element('themeToggle').addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, currentTheme);
  updateView();
});
element('studentDiagnosticTab').addEventListener('click', () => { state.studentSection = 'diagnostic'; saveAndRender(); });
element('studentPathTab').addEventListener('click', () => { state.studentSection = 'path'; saveAndRender(); });
element('quizTab').addEventListener('click', () => { state.tab = 'quiz'; saveAndRender(); });
element('importTab').addEventListener('click', () => { state.tab = 'import'; saveAndRender(); });
element('studentStats').addEventListener('click', event => {
  if (event.target.id !== 'openAvatarModal') return;
  element('avatarModal').classList.remove('hidden');
  element('avatarModal').classList.add('flex');
});
const hideModal = id => { element(id).classList.add('hidden'); element(id).classList.remove('flex'); };
element('closeAvatarModal').addEventListener('click', () => hideModal('avatarModal'));
element('avatarModal').addEventListener('click', event => { if (event.target.id === 'avatarModal') hideModal('avatarModal'); });
element('apiKeyOpenBtn').addEventListener('click', () => {
  element('apiKeyInput').value = readApiKey();
  element('apiKeyModal').classList.remove('hidden');
  element('apiKeyModal').classList.add('flex');
});
element('closeApiKeyModal').addEventListener('click', () => hideModal('apiKeyModal'));
element('apiKeyModal').addEventListener('click', event => { if (event.target.id === 'apiKeyModal') hideModal('apiKeyModal'); });
element('apiKeyForm').addEventListener('submit', event => {
  event.preventDefault();
  const key = element('apiKeyInput').value.trim();
  try {
    if (key) localStorage.setItem(API_KEY_STORAGE, key);
    else localStorage.removeItem(API_KEY_STORAGE);
  } catch { alert('Браузер заблокировал localStorage. Разрешите локальное хранилище для этого сайта.'); }
  hideModal('apiKeyModal');
});
element('clearApiKey').addEventListener('click', () => { try { localStorage.removeItem(API_KEY_STORAGE); } catch {} element('apiKeyInput').value = ''; });
element('focusModeBtn').addEventListener('click', () => { activeStudent().focusModeEnabled = !activeStudent().focusModeEnabled; saveAndRender(); });
element('dismissFocusAlert').addEventListener('click', () => { activeStudent().focusAlert = false; saveAndRender(); });

element('cosmeticShop').addEventListener('click', event => {
  const button = event.target.closest('[data-cosmetic-id]');
  if (!button) return;
  const student = activeStudent();
  const item = COSMETICS.find(cosmetic => cosmetic.id === button.dataset.cosmeticId);
  if (!item) return;
  const owned = student.ownedCosmetics.includes(item.id);
  const currentlyEquipped = item.type === 'frame' ? student.avatarFrame === item.id : student.avatarBadge === item.id;
  if (!owned) {
    if (student.xp < item.cost) { alert('Недостаточно XP для покупки.'); return; }
    student.xp -= item.cost;
    student.ownedCosmetics.push(item.id);
  }
  if (item.type === 'frame') student.avatarFrame = currentlyEquipped ? 'none' : item.id;
  else student.avatarBadge = currentlyEquipped ? 'none' : item.id;
  saveAndRender();
});

element('diagnosticPanel').addEventListener('click', event => {
  if (event.target.id !== 'demoAnswersBtn') return;
  const student = activeStudent();
  student.answers = { q1: 'True', q2: 'True', q3: 'Not Given' };
  student.checked = false;
  renderDiagnostic();
});

element('chatQuickPrompts').addEventListener('click', event => {
  const button = event.target.closest('[data-prompt]');
  if (!button) return;
  element('chatInput').value = button.dataset.prompt;
  element('chatForm').requestSubmit();
});

element('studentTeacherForm').addEventListener('submit', event => {
  event.preventDefault();
  const input = element('studentTeacherInput');
  const text = input.value.trim();
  if (!text) return;
  activeStudent().teacherMessages.push({ from: 'student', text, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) });
  input.value = '';
  saveAndRender();
});

element('teacherReplyForm').addEventListener('submit', event => {
  if (event.target.id !== 'teacherReplyForm') return;
  event.preventDefault();
  const input = event.target.elements.reply;
  const text = input.value.trim();
  if (!text) return;
  activeStudent().teacherMessages.push({ from: 'teacher', text, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) });
  saveAndRender();
});

document.addEventListener('visibilitychange', () => {
  const student = activeStudent();
  if (!student.focusModeEnabled || !student.quizActive || document.visibilityState !== 'hidden') return;
  student.tabSwitches += 1;
  student.focusAlert = true;
  persist();
  if (state.profileId) updateView();
});

element('diagnosticPanel').addEventListener('input', event => {
  const student = activeStudent();
  if (event.target.id === 'importPrompt') student.importPrompt = event.target.value;
  if (event.target.id === 'importAnswer') student.importAnswer = event.target.value;
  if (event.target.name) student.answers[event.target.name] = event.target.value;
  if (event.target.name && state.tab === 'quiz' && student.focusModeEnabled) student.quizActive = true;
  persist();
});

element('diagnosticPanel').addEventListener('submit', async event => {
  event.preventDefault();
  if (working) return;
  const profileId = state.profileId;
  const student = state.students[profileId];
  if (event.target.id === 'quizForm') {
    const unanswered = Object.keys(QUIZ_ANSWERS).some(id => !student.answers[id]);
    if (unanswered) { alert('Выберите True, False или Not Given для каждого утверждения.'); return; }
    const wrong = Object.entries(QUIZ_ANSWERS).filter(([id, answer]) => student.answers[id] !== answer);
    student.checked = true;
    const distinctionError = wrong.some(([id]) => id === 'q2' || id === 'q3');
    student.gap = wrong.length ? (distinctionError ? 'Выявлен пробел: путаница между False и Not Given. False означает, что текст противоречит утверждению; Not Given — что данных недостаточно.' : 'Выявлен пробел: важно подтверждать ответ конкретными деталями из текста.') : '';
    const gap = student.gap || 'Пробелов в определении True / False / Not Given не выявлено.';
    saveDiagnostic(profileId, 'Reading True/False/Not Given', wrong.length > 0, gap, wrong.length ? 15 : 25);
    persist();
    if (!wrong.length) {
      student.summary = 'Ученик верно определил все три ответа, опираясь на текст. Следующий шаг — применить тот же навык к более сложному отрывку.';
      student.lastIssue = '';
    }
    working = true;
    updateView();
    await analyzeAndGuide(profileId, { mode: 'diagnostic', topic: 'IELTS Reading: True / False / Not Given', diagnosticGap: gap, studentAnswer: wrong.map(([id]) => `${id}: ${student.answers[id]}`).join(', ') || 'Все три утверждения определены верно.', context: 'Greenfield Library reading passage. Help identify whether each statement is supported, contradicted, or not mentioned.' }, { addTask: true, addTutorMessage: wrong.length > 0 });
  }
  if (event.target.id === 'importForm') {
    const prompt = student.importPrompt.trim();
    const answer = student.importAnswer.trim();
    if (!prompt || !answer) { alert('Добавьте условие задания и свой ответ, чтобы начать разбор.'); return; }
    const topic = inferImportedTopic(prompt);
    const gap = `Проверь, как применять тему «${topic}» и обосновывать шаги решения данными из задания.`;
    student.lastIssue = gap;
    saveDiagnostic(profileId, topic, true, gap, 15);
    student.chat.push({ role: 'assistant', text: 'Посмотрим на задачу вместе. Сначала найдем, какие слова в условии важны для твоего ответа.' });
    working = true;
    persist();
    updateView();
    await analyzeAndGuide(profileId, { mode: 'diagnostic', topic, context: prompt, studentAnswer: answer, diagnosticGap: gap }, { addTask: true, addTutorMessage: true });
  }
});

element('chatForm').addEventListener('submit', async event => {
  event.preventDefault();
  event.stopPropagation();
  if (working) return;
  const input = element('chatInput');
  const message = input.value.trim();
  if (!message) return;
  const profileId = state.profileId;
  const student = state.students[profileId];
  input.value = '';
  student.chat.push({ role: 'user', text: message });
  student.tutorTurns += 1;
  working = true;
  persist();
  renderChat();
  renderChatWorking();
  try {
    const result = await callAI({ mode: 'tutor', topic: 'Socratic tutoring', context: getTaskContext(student), studentAnswer: message, diagnosticGap: student.gap || student.lastIssue }, profileId);
    state.students[profileId].chat.push({ role: 'assistant', text: result.tutor_reply || result.tutor_hint || 'Какой шаг задачи ты уже попробовал выполнить?' });
    state.students[profileId].summary = result.teacher_summary || state.students[profileId].summary;
  } catch (error) {
    state.students[profileId].chat.push({ role: 'assistant', text: `Не удалось получить ответ от AI. ${buildFallback({ mode: 'tutor', studentAnswer: message }, state.students[profileId], state.students[profileId].chat).tutor_reply}` });
    console.error('Chat response failed:', error);
  } finally {
    working = false;
    persist();
    if (state.profileId === profileId) {
      renderChat();
      renderChatWorking();
      renderTeacher();
    }
  }
});

element('chatInput').addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  if (typeof element('chatForm').requestSubmit === 'function') element('chatForm').requestSubmit();
  else element('chatForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});

element('askAnswerBtn').addEventListener('click', () => {
  const student = activeStudent();
  student.chat.push({ role: 'user', text: 'Попросить готовый ответ' });
  student.chat.push({ role: 'assistant', text: `Я не могу выдать готовый ответ — зато помогу тебе найти его самостоятельно. ${student.gap || 'Вернись к ключевым словам в условии и найди подтверждение в тексте.'} Какой фрагмент кажется тебе самым важным?` });
  student.tutorTurns += 1;
  persist();
  updateView();
});

element('recommendationPanel').addEventListener('input', event => {
  if (event.target.id === 'recommendationInput') { activeStudent().recommendedTask = event.target.value; persist(); }
});
element('recommendationPanel').addEventListener('change', event => {
  if (event.target.id !== 'recommendationInput') return;
  const student = activeStudent();
  student.approval = false;
  const approved = [...student.path].reverse().find(task => task.kind === 'ai' && task.teacherApproved);
  if (approved) { approved.teacherApproved = false; approved.detail = student.recommendedTask; }
  persist();
  updateView();
});
element('recommendationPanel').addEventListener('click', event => {
  const taskButton = event.target.closest('[data-approve-task]');
  if (taskButton) {
    const task = activeStudent().path.find(item => item.id === taskButton.dataset.approveTask);
    if (task) { task.teacherApproved = true; task.status = '✓ Одобрено учителем'; persist(); updateView(); }
    return;
  }
  if (event.target.id !== 'approveBtn') return;
  const student = activeStudent();
  const pending = [...student.path].reverse().find(task => task.kind === 'ai' && !task.teacherApproved);
  student.approval = true;
  if (pending) { pending.detail = student.recommendedTask; pending.teacherApproved = true; }
  else if (!student.path.some(task => task.kind === 'ai' && task.teacherApproved && task.detail === student.recommendedTask)) student.path.push({ id: `teacher-${Date.now()}`, title: 'Тренировка · одобрено учителем', detail: student.recommendedTask, status: 'Добавлено AI', kind: 'ai', teacherApproved: true });
  persist();
  updateView();
});

element('classLessonCard').addEventListener('click', event => {
  if (event.target.id !== 'approveLessonPlanBtn' || state.lessonPlan.approved) return;
  state.lessonPlan.approved = true;
  state.lessonPlan.status = 'План урока утвержден учителем';
  persist();
  updateView();
});

element('classRoster').addEventListener('click', event => {
  const card = event.target.closest('[data-student-profile]');
  if (!card) return;
  state.profileId = card.dataset.studentProfile;
  saveAndRender();
});

element('resetBtn').addEventListener('click', () => {
  if (!confirm('Сбросить демо-данные для обоих профилей?')) return;
  const { role, profileId } = state;
  state = createInitialState();
  state.role = role;
  state.profileId = profileId;
  working = false;
  saveAndRender();
});

updateView();