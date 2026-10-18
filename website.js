'use strict';
(() => {
  const track = (name, props = {}) => window.meldAnalytics?.track(name, props);
  const panel = document.getElementById('workflow-panel');
  const tabs = [...document.querySelectorAll('[data-step]')];
  const originalPanel = panel?.innerHTML;
  const stages = [
    {html: `<div class="panel-heading"><span class="status">Cause identified by Meld</span><span class="sample-time">Logs + source code</span></div><h3>A failed request holds its slot.</h3><p class="panel-summary">Meld traces checkout failures to a missing release on the error path.</p><div class="evidence-list diagnosis-evidence"><div><span>Traffic spike</span><span class="muted">Request volume is steady</span></div><div><span>Database outage</span><span class="muted">Database checks pass</span></div><div><span>Leaked capacity slots</span><span class="accent">Supported by logs and code</span></div></div><p class="panel-note">Next: release capacity on every exit path.</p>`, caption: 'Evidence narrows the cause. The diagnosis determines the fix.'},
    {html: originalPanel, caption: 'A targeted fix, within your deployment policy.'},
    {html: `<div class="panel-heading"><span class="status">Recovery verified by Meld</span><span class="sample-time">After deployment</span></div><h3>Healthy requests. Not just a green deploy.</h3><p class="panel-summary">Meld checks fresh traffic against the service’s recovery policy.</p><div class="checks"><div><strong>0.3%</strong><small>Request errors<br>Target &lt;1%</small></div><div><strong>240 ms</strong><small>p95 latency<br>Target &lt;500 ms</small></div><div><strong>324</strong><small>Fresh requests<br>Two-minute window</small></div></div><p class="panel-note">All example checks pass. Without sufficient evidence, recovery stays unverified.</p>`, caption: 'Fresh evidence confirms the service is healthy again.'}
  ];
  let current = 1;
  const visited = new Set([1]);
  function showStage(index, focus = false) {
    current = (index + stages.length) % stages.length;
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === current)); tab.tabIndex = i === current ? 0 : -1; });
    panel.innerHTML = stages[current].html;
    panel.setAttribute('aria-labelledby', `step-${current}`);
    document.getElementById('stage-caption').textContent = stages[current].caption;
    document.getElementById('next-stage').innerHTML = current === stages.length - 1 ? 'Restart <span aria-hidden="true">↺</span>' : 'Next <span aria-hidden="true">→</span>';
    document.getElementById('next-stage').setAttribute('aria-label', current === stages.length - 1 ? 'Restart resolution stages' : 'Next resolution stage');
    if (focus) tabs[current].focus();
    track('workflow_step_viewed', {step: current + 1});
    visited.add(current);
    if (visited.size === stages.length) { track('workflow_completed'); visited.clear(); }
  }
  if (panel) {
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => showStage(index));
      tab.addEventListener('keydown', event => {
        const keys = {ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: stages.length - 1};
        if (event.key in keys) { event.preventDefault(); showStage(keys[event.key], true); }
      });
    });
    document.getElementById('next-stage').addEventListener('click', () => showStage(current + 1));
    document.querySelectorAll('[data-show-step]').forEach(link => link.addEventListener('click', () => showStage(Number(link.dataset.showStep))));
  }
  document.querySelectorAll('[data-event]').forEach(el => el.addEventListener('click', () => track(el.dataset.event, {placement: el.dataset.placement || 'page'})));
  document.querySelectorAll('video').forEach(video => {
    let started = false;
    const milestones = new Set();
    video.addEventListener('play', () => { if (!started) { track('demo_video_started'); started = true; } });
    video.addEventListener('timeupdate', () => {
      const percentage = video.duration > 0 ? video.currentTime / video.duration * 100 : 0;
      [25, 50, 75].forEach(value => { if (percentage >= value && !milestones.has(value)) { milestones.add(value); track('demo_video_progress', {percent: value}); } });
    });
    video.addEventListener('ended', () => track('demo_video_completed'));
  });
  if ('IntersectionObserver' in window) {
    const seen = new Set();
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting && !seen.has(entry.target)) { seen.add(entry.target); track('section_viewed', {section: entry.target.dataset.section}); }
    }), {threshold: 0.25});
    document.querySelectorAll('[data-section]').forEach(el => observer.observe(el));
  }
  const form = document.getElementById('early-access-form');
  if (form) {
    const status = document.getElementById('access-status');
    const button = form.querySelector('button[type=submit]');
    let submitting = false;
    form.addEventListener('focusin', () => track('access_form_started'), {once: true});
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (submitting || !form.reportValidity()) return;
      submitting = true;
      button.disabled = true;
      status.classList.remove('error');
      status.textContent = 'Sending your request…';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('https://app.meldhq.net/api/early-access', {
          method: 'POST', headers: {'Content-Type': 'application/json'}, signal: controller.signal,
          body: JSON.stringify({email: form.elements.email.value.trim(), website: form.elements.website.value})
        });
        if (!response.ok) throw new Error('request_failed');
        form.reset();
        status.textContent = 'Thanks — your request is in. A founder will reach out by email.';
        track('access_request_submitted');
      } catch (error) {
        status.classList.add('error');
        status.textContent = 'We couldn’t confirm your request. Please retry or email sricharanravi@meldhq.net.';
        track('access_request_failed', {reason: error.name === 'AbortError' ? 'timeout' : 'request_failed'});
      } finally { clearTimeout(timeout); submitting = false; button.disabled = false; }
    });
  }
})();

// Play once in view. Keep all evidence readable; never loop or move the layout.
(() => {
  const preview = document.querySelector('.incident-preview');
  if (!preview) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rows = [...preview.querySelectorAll('[data-scene]')];
  const diagnosisTitle = preview.querySelector('[data-diagnosis-title]');
  const diagnosis = preview.querySelector('[data-diagnosis]');
  const bars = [...preview.querySelectorAll('.preview-progress i')];
  const toggle = document.getElementById('preview-toggle');
  const next = document.getElementById('preview-next');
  let stage = 3, timer, playing = false, started = false, inView = false;
  function render() {
    preview.dataset.heroStage = stage;
    if (diagnosisTitle && diagnosis) {
      diagnosisTitle.textContent = stage >= 2 ? 'Slot leak identified' : 'Capacity exhausted';
      diagnosis.textContent = stage >= 2 ? 'Shared evidence pinpoints the error path.' : 'Testing two leads: traffic spike or leaked slots.';
    }
    rows[1].classList.toggle('has-pivot', stage === 2 && !reducedMotion.matches);
    rows.forEach((row, index) => { row.classList.toggle('is-current', index === stage); row.classList.toggle('is-complete', index < stage); });
    bars.forEach((bar, index) => bar.classList.toggle('is-filled', index <= stage));
    document.getElementById('preview-position').textContent = `${stage + 1} / 4`;
    toggle.textContent = playing ? 'Pause Ⅱ' : stage === 3 ? 'Replay ↻' : 'Play ▷';
    next.disabled = stage === 3;
    next.style.opacity = stage === 3 ? '.4' : '1';
  }
  function schedule() {
    clearTimeout(timer);
    if (!playing || !inView || document.hidden) return;
    timer = setTimeout(() => { stage++; if (stage === 3) playing = false; render(); schedule(); }, stage === 2 ? 5500 : 4000);
  }
  function start() { started = true; stage = 0; playing = true; render(); schedule(); }
  toggle.addEventListener('click', () => {
    if (stage === 3) { start(); return; }
    playing = !playing; render(); schedule();
  });
  next.addEventListener('click', () => { playing = false; stage = Math.min(stage + 1, 3); render(); schedule(); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { clearTimeout(timer); playing = false; stage = 3; render(); } });
  document.addEventListener('visibilitychange', schedule);
  preview.querySelector('.preview-controls').hidden = false;
  render();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView && !started && !reducedMotion.matches) start(); else schedule();
    }, {threshold: .45});
    observer.observe(preview);
  } else { inView = true; }
})();
