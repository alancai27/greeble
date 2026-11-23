// PROTOTYPE (issue #9): floating variant switcher. Dev builds only.
export function mountSwitcher(keys: string[], names: Record<string, string>, current: string) {
  const go = (d: number) => {
    const i = (keys.indexOf(current) + d + keys.length) % keys.length;
    const url = new URL(location.href);
    url.searchParams.set('variant', keys[i]);
    location.replace(url);
  };
  const bar = document.createElement('div');
  bar.className = 'proto-switcher';
  bar.innerHTML =
    `<button type="button" aria-label="Previous variant">&#8249;</button>` +
    `<span>${current.toUpperCase()} (${names[current]})</span>` +
    `<button type="button" aria-label="Next variant">&#8250;</button>`;
  const [prev, next] = bar.querySelectorAll('button');
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  window.addEventListener('keydown', (e) => {
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.matches('input, textarea') || el.isContentEditable)) return;
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });
  document.body.appendChild(bar);
}
