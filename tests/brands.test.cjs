'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('website.css', 'utf8');
const claude = fs.readFileSync('assets/brands/claude.svg', 'utf8');
test('Claude uses a vector asset, never an OS-dependent emoji', () => {
  assert.match(html, /<img[^>]+class="claude-mark"[^>]+src="assets\/brands\/claude\.svg"/);
  assert.doesNotMatch(html, /✳/);
});
test('Claude retains its official authored orange fill', () => {
  assert.match(claude, /fill="#D97757"/);
  assert.doesNotMatch(claude, /currentColor|filter|script/i);
});
test('Third-party logo presentation does not apply grayscale or hue recoloring', () => {
  assert.doesNotMatch(css, /filter\s*:\s*(grayscale|hue-rotate|sepia|invert)/);
  assert.match(css, /\.claude-mark\{object-fit:contain;filter:none;opacity:1\}/);
});

test('UI play and outbound-link icons use SVG, not emoji-eligible glyphs', () => {
  const card = fs.readFileSync('card.html', 'utf8');
  assert.doesNotMatch(html + card, /[▶↗]/);
  assert.match(html, /class="play-icon" aria-hidden="true"><svg /);
});

test('Responsive line breaks preserve readable heading word spacing', () => {
  for (const file of ['index.html', 'card.html', 'privacy.html', 'website.js']) {
    const content = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(content, /<br\b[^>]*>(?!\s)/, file);
  }
  assert.match(html, /See Meld<br> <em>at work/);
  assert.match(html, /Talk to the people<br> building Meld/);
});
test('Decorative UI controls avoid font-dependent glyphs and SVG announcements', () => {
  const script = fs.readFileSync('website.js', 'utf8');
  assert.doesNotMatch(html + script, /[▶↗↳⌄✓−↻Ⅱ▷]/);
  assert.doesNotMatch(html + script, /<svg class="icon">/);
  assert.match(script, /toggle.textContent=playing\?'Pause':stage===3\?'Replay':'Play'/);
});
