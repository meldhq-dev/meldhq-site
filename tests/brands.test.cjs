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
