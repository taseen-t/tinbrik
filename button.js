// "Book a call" (hero button + floating one): Split with a highlighter-yellow calendar segment
// and a label that rolls through a few phrases. Runs before world.js, which sizes the float from it.
const CAL = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 7h11M5.5 2v3M10.5 2v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const WORDS = ['Book a call', 'Pick a time', 'Say hello', 'Book a call']; // last repeats the first so the loop is seamless

for (const el of document.querySelectorAll('.book, .float')) {
  el.innerHTML = `<span class="bt-words" aria-hidden="true">${WORDS.map((w) => `<span>${w}</span>`).join('')}</span><span class="bt-seg">${CAL}</span>`;
  el.setAttribute('aria-label', 'Book a call');
}
