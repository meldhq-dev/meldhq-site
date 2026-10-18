'use strict';
(() => {
  const track = (name, props = {}) => window.meldAnalytics?.track(name, props);
  const panel = document.getElementById('workflow-panel');
  const tabs = [...document.querySelectorAll('[data-step]')];
  const originalPanel = panel?.innerHTML;
  const stages = [
    {html: originalPanel, caption: 'Evidence first. Hypotheses stay open until the checks support them.'},
    {html: `<div class="panel-heading"><span class="status">Diagnosis updated</span><span class="sample-time">Engineer + Codex → Meld</span></div><h3>One finding changes the next move.</h3><div class="finding"><span class="avatar">SR</span><div><strong>Sricharan + Codex</strong><p>The error path acquires a capacity slot but never releases it. Here’s the code.</p></div></div><div class="diagnosis-change"><div><span class="feature-index">BEFORE THE FINDING</span><p>Capacity is exhausted.<br>Traffic spike or leaked slots?</p></div><span class="change-arrow" aria-hidden="true">→</span><div><span class="feature-index">AFTER MELD CHECKS THE EVIDENCE</span><p>Source supports a slot leak.<br>Test a release on every exit path.</p></div></div><p class="panel-note">The shared diagnosis changes. Responders can steer their own agents using the same evidence.</p>`, caption: 'Multiplayer AI: shared evidence changes what the team investigates next.'},
    {html: `<div class="panel-heading"><span class="status">Approved change</span><span class="sample-time">Scoped deployment access</span></div><h3>Fix the failure. Deploy with control.</h3><p class="panel-summary">Review the exact change, then deploy within the team’s permissions and approval rules.</p><details class="example-diff"><summary>Inspect the proposed code change</summary><pre class="example-code">try:\n    return handle_checkout()\n<span class="added">+ finally:\n+     capacity.release()</span></pre></details><div class="evidence-list" style="margin-top:18px"><div><span>Change</span><span>Release capacity on every exit path</span></div><div><span>Scope</span><span>Checkout service · production</span></div><div><span>Approval</span><span class="accent">Authorized responder</span></div></div><p class="panel-note">The deployment and its result stay with the investigation.</p>`, caption: 'From diagnosis to an approved fix, followed by recovery checks.'},
    {html: `<div class="panel-heading"><span class="status">Recovery verified</span><span class="sample-time">After the fix is deployed</span></div><h3>Check what customers experience.</h3><p class="panel-summary">Meld checks fresh checkout traffic against the service’s configured recovery policy.</p><div class="checks"><div><strong>0.3%</strong><small>Request errors<br>Target &lt;1%</small></div><div><strong>240 ms</strong><small>p95 latency<br>Target &lt;500 ms</small></div><div><strong>324</strong><small>Fresh requests<br>Two-minute window</small></div></div><p class="panel-note">These example checks pass. Missing or insufficient evidence would leave recovery unverified.</p>`, caption: 'A deployed change is followed by evidence that the service recovered.'},
    {html: `<div class="panel-heading"><span class="status draft">Postmortem draft</span><span class="sample-time">Ready for team review</span></div><h3>Close the incident. Keep the evidence.</h3><p class="panel-summary">Meld brings the record into a postmortem your team can edit, with follow-ups linked to what happened.</p><ul class="stage-list"><li>Cause: a capacity slot leaked on the error path.</li><li>Fix: release the slot on every exit path.</li><li>Recovery: fresh traffic passed the service policy.</li><li>Follow-up: add a regression test for this failure.</li></ul>`, caption: 'Preserve the cause, decisions and verified outcome for the next investigation.'}
  ];
  let current = 0;
  const visited = new Set([0]);
  function showStage(index, focus = false) {
    current = (index + stages.length) % stages.length;
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === current)); tab.tabIndex = i === current ? 0 : -1; });
    panel.innerHTML = stages[current].html;
    panel.setAttribute('aria-labelledby', `step-${current}`);
    document.getElementById('stage-caption').textContent = stages[current].caption;
    document.getElementById('next-stage').innerHTML = current === 4 ? 'Restart <span aria-hidden="true">↺</span>' : 'Next <span aria-hidden="true">→</span>';
    if (focus) tabs[current].focus();
    track('workflow_step_viewed', {step: current + 1});
    visited.add(current);
    if (visited.size === stages.length) { track('workflow_completed'); visited.clear(); }
  }
  if (panel) {
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => showStage(index));
      tab.addEventListener('keydown', event => {
        const keys = {ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: 4};
        if (event.key in keys) { event.preventDefault(); showStage(keys[event.key], true); }
      });
    });
    document.getElementById('next-stage').addEventListener('click', () => showStage(current + 1));
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
