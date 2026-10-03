type Child = Node | string | number | null | undefined | false | Child[];

type Props = Record<string, unknown> & { class?: string; style?: Partial<CSSStyleDeclaration> | string };

/** Mini-helper de création d'éléments : h('div', { class: 'x', onClick }, 'texte', child). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') {
        if (typeof v === 'string') el.setAttribute('style', v);
        else Object.assign(el.style, v);
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'html') el.innerHTML = String(v);
      else if (k in el && k !== 'list' && k !== 'form') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function button(label: Child, onClick: () => void, cls = 'btn'): HTMLButtonElement {
  return h('button', { class: cls, type: 'button', onClick }, label);
}

/** Boîte de dialogue modale simple avec boutons. */
export function modal(content: Child, actions: { label: string; onClick: () => void; cls?: string }[]): HTMLElement {
  const overlay = h('div', { class: 'modal-overlay' });
  const box = h('div', { class: 'modal' }, content, h('div', { class: 'modal-actions' }, actions.map((a) => button(a.label, () => { overlay.remove(); a.onClick(); }, a.cls ?? 'btn'))));
  overlay.appendChild(box);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return overlay;
}

export function toast(text: string, cls = ''): void {
  const el = h('div', { class: `toast ${cls}` }, text);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 2600);
}
