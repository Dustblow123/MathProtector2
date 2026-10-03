import { audio } from '../../audio/AudioManager';
import { speech } from '../../audio/speech';
import { Input } from '../../core/input';
import { factsMap, storeFacts } from '../../data/profile';
import type { SessionResult } from '../../game/types';
import { t } from '../../i18n';
import { classifyError } from '../../learning/confusions';
import { commuted, parseFactId } from '../../learning/facts';
import { recordAnswer, recordCommutedCredit } from '../../learning/model';
import type { Fact } from '../../learning/types';
import { chooseStrategy } from '../../learning/strategies';
import { drawStrategyVisual } from '../../render/strategyVisual';
import { strategyLines } from '../../ui/strategyText';
import { button, clear, h } from '../../ui/dom';
import { createNumpad } from '../../ui/numpad';
import type { App, ResultsParams, ScreenResult } from '../App';

export const DRILL_SIZE = 5;

/** Choisit les faits du mini-drill : faits ratés puis faits confondus, sans produit répété d'affilée. */
export function pickDrillFacts(result: SessionResult, maxTable: number): Fact[] {
  const out: Fact[] = [];
  const seen = new Set<string>();
  const push = (f: Fact) => {
    if (seen.has(f.id) || out.length >= DRILL_SIZE) return;
    seen.add(f.id);
    out.push(f);
  };
  for (const id of result.weakFacts) push(parseFactId(id));
  for (const id of result.weakFacts) {
    const f = parseFactId(id);
    if (f.b < maxTable) push(parseFactId(`${f.a}x${f.b + 1}`));
    if (f.b > 1) push(parseFactId(`${f.a}x${f.b - 1}`));
  }
  // Évite deux produits identiques consécutifs.
  for (let i = 1; i < out.length; i++) {
    if (out[i]!.product === out[i - 1]!.product) {
      const j = out.findIndex((f, k) => k > i && f.product !== out[i - 1]!.product);
      if (j > 0) [out[i], out[j]] = [out[j]!, out[i]!];
    }
  }
  return out;
}

/** Mini-drill : 5 questions flash sur les faits ratés, juste après les résultats. */
export function renderDrill(app: App, params: ResultsParams): ScreenResult {
  const p = app.p;
  const facts = factsMap(p);
  const fluentMs = app.fluentMs();
  const queue = pickDrillFacts(params.result, p.maxTable);
  let index = 0;
  let buffer = '';
  let locked = false;
  let correctCount = 0;
  let shownAt = 0;
  let timerRaf = 0;
  const limit = fluentMs * 1.5;
  speech.enabled = app.settings.speech;

  const card = h('div', { class: 'drill-card' });
  const question = h('div', { class: 'drill-question' });
  const answer = h('div', { class: 'drill-answer' }, '');
  const feedback = h('div', { class: 'drill-feedback' });
  const bar = h('i', { style: 'width:100%' });
  const progress = h('div', { class: 'drill-progress' });
  const hintCanvas = h('canvas', { width: 320, height: 170, class: 'drill-hint' }) as HTMLCanvasElement;
  hintCanvas.style.display = 'none';
  const stepsEl = h('div', { class: 'drill-steps' });
  card.append(progress, question, answer, h('div', { class: 'progress drill-timer' }, bar), feedback, stepsEl, hintCanvas);

  const input = new Input();
  const digit = (d: number) => {
    if (locked || buffer.length >= 4 || (buffer === '' && d === 0)) return;
    buffer += String(d);
    answer.textContent = buffer;
    audio.type();
  };
  const backspace = () => {
    if (locked) return;
    buffer = buffer.slice(0, -1);
    answer.textContent = buffer;
  };
  const confirm = () => {
    if (locked || buffer === '') return;
    resolve(Number(buffer));
  };
  input.on('digit', digit);
  input.on('backspace', backspace);
  input.on('confirm', confirm);
  input.attach();

  const finish = () => {
    cancelAnimationFrame(timerRaf);
    input.detach();
    storeFacts(p, facts);
    p.stats.drillAnswers += queue.length;
    app.persist(true);
    speech.cancel();
    app.go('results', { ...params, drillDone: { total: queue.length, correct: correctCount } });
  };

  const show = () => {
    if (index >= queue.length) {
      finish();
      return;
    }
    const f = queue[index]!;
    buffer = '';
    locked = false;
    answer.textContent = '';
    feedback.textContent = '';
    feedback.className = 'drill-feedback';
    hintCanvas.style.display = 'none';
    clear(stepsEl);
    question.textContent = `${f.a} × ${f.b} = ?`;
    progress.textContent = `${index + 1} / ${queue.length}`;
    shownAt = performance.now();
    speech.fact(f);
    const tick = () => {
      const left = Math.max(0, 1 - (performance.now() - shownAt) / limit);
      bar.style.width = `${left * 100}%`;
      if (!locked) timerRaf = requestAnimationFrame(tick);
    };
    tick();
  };

  const resolve = (value: number) => {
    const f = queue[index]!;
    locked = true;
    const rt = performance.now() - shownAt;
    const correct = value === f.product;
    const prev = facts.get(f.id) ?? recordAnswer({ id: f.id, pKnown: 0.3, stability: 0.5, lastReview: 0, reps: 0, lapses: 0, rtEma: 0, recent: [], streak: 0 }, { correct, rt, now: Date.now(), fluentMs });
    facts.set(f.id, facts.has(f.id) ? recordAnswer(prev, { correct, rt, now: Date.now(), fluentMs }) : prev);
    const c = commuted(f);
    const cs = facts.get(c.id);
    if (cs && c.id !== f.id) facts.set(c.id, recordCommutedCredit(cs, correct));
    if (correct) {
      correctCount++;
      feedback.textContent = `✓ ${f.a} × ${f.b} = ${f.product}`;
      feedback.className = 'drill-feedback good';
      audio.laser();
    } else {
      const a = classifyError(f, value, p.maxTable);
      let extra = '';
      if (a.kind === 'addition') extra = t('game.addition', { answer: value, a: f.a, b: f.b });
      else if (a.kind === 'digit-swap') extra = t('game.digitSwap', { product: f.product });
      else if (a.confusedWith) extra = t('game.confusedWith', { answer: value, fact: `${a.confusedWith.a} × ${a.confusedWith.b}` });
      feedback.textContent = `✗ ${value} — ${f.a} × ${f.b} = ${f.product}${extra ? ` · ${extra}` : ''}`;
      feedback.className = 'drill-feedback bad';
      audio.miss();
      speech.answer(f);
      const strategy = chooseStrategy(f, facts, p.maxTable);
      for (const line of strategyLines(strategy)) stepsEl.appendChild(h('div', null, line));
      hintCanvas.style.display = '';
      const ctx = hintCanvas.getContext('2d');
      if (ctx) drawStrategyVisual(ctx, strategy, hintCanvas.width, hintCanvas.height);
    }
    index++;
    setTimeout(show, correct ? 900 : 4200);
  };

  const pad = createNumpad({ onDigit: digit, onBackspace: backspace, onConfirm: confirm }, { hidden: !app.usesTouch(), confirmLabel: 'OK' });
  const el = h(
    'div',
    { class: 'screen' },
    h(
      'div',
      { class: 'screen-inner drill' },
      h('div', { class: 'topbar' }, h('h2', null, t('drill.title')), h('span', { class: 'muted small' }, t('drill.subtitle'))),
      card,
      h('div', { class: 'row', style: 'justify-content:center' }, pad),
      h('div', { class: 'row', style: 'justify-content:center' }, button(t('drill.skip'), finish, 'btn btn-ghost')),
    ),
  );
  if (queue.length === 0) setTimeout(finish, 0);
  else show();
  clear(feedback);
  return { el, destroy: () => { cancelAnimationFrame(timerRaf); input.detach(); speech.cancel(); } };
}
