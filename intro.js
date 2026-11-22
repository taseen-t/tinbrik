// Intro (appears when the hero opens): a giant statement whose words slide in, then a highlighter
// sweeps across the [bracketed] phrases. Runs before world.js, which flies Book a call into .book-slot
// and sets --r (0..1 reveal) and .opened on .stage.
const stage = document.querySelector('.stage'), intro = stage.querySelector('.intro');

// "[phrase]" becomes a highlighter mark; every word still slides in on its own.
const marked = (t) => { let k = 0, m = 0; return t.split(/(\[[^\]]+\])/).map((part) => {
  const ws = part.replace(/[[\]]/g, '').split(' ').filter(Boolean).map((w) => `<span class="w" style="--k:${k++}">${w}</span>`).join(' ');
  const pad = (re) => (part.match(re) ? ' ' : '');
  return pad(/^\s/) + (part.startsWith('[') ? `<mark style="--k:${m++}">${ws}</mark>` : ws) + pad(/\s$/);
}).join(''); };

// The full stop sits inside the last mark, so it never wraps onto a line of its own.
const html = marked('We make [brands people remember] for [small, ambitious teams.]').replace('">remember<', '" data-serif>remember<');
intro.innerHTML = `
  <h1 class="big">${html}</h1>
  <p class="lead now">One small studio for your logo, your website and your packaging, from first sketch to launch.</p>
  <div class="cta"><span class="book-slot" aria-hidden="true"></span><a class="see" href="#services">What we do <span aria-hidden="true">↓</span></a></div>`;
stage.dataset.i = '';
