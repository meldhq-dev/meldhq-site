'use strict';
(() => {
  const track = (name, props = {}) => window.meldAnalytics?.track(name, props);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const panel = document.getElementById('workflow-panel');
  const tabs = [...document.querySelectorAll('[data-step]')];
  const arrow = '<svg class="icon" aria-hidden="true" focusable="false"><use href="#arrow"/></svg>';
  const stages = panel ? [
    {html: panel.innerHTML, caption: 'Evidence determines the fix.'},
    {html: `<div class="panel-eyebrow"><span class="status-dot"></span> FIX PREPARED BY MELD</div><h3>Release the slot.<br> Stop the failures.</h3><p>A targeted change makes sure failed requests don’t exhaust capacity.</p><pre class="code-panel" aria-label="Illustrative code diff: release capacity in a finally block">if capacity.acquire(timeout=0.2):
    try:
        return handle_checkout()
    except CheckoutError:
        return service_unavailable()
<span class="added">+   finally:
+       capacity.release()</span></pre><div class="fix-scope"><span>Deployment scope<strong>Checkout only</strong></span><span>Execution<strong>Your permissions &amp; approvals</strong></span></div>`, caption: 'A targeted fix. Your deployment policy.'},
    {html: `<div class="panel-eyebrow"><span class="status-dot"></span> RECOVERY VERIFIED</div><h3>Healthy requests.<br> Not just a green deploy.</h3><p>Meld checks fresh traffic against the service’s recovery policy.</p><div class="checks"><div><strong>0.3%</strong><small>Request errors<br> Target &lt;1%</small></div><div><strong>240 ms</strong><small>p95 latency<br> Target &lt;500 ms</small></div><div><strong>324</strong><small>Fresh requests<br> Two-minute window</small></div></div><div class="verified-banner"><svg class="icon" aria-hidden="true" focusable="false"><use href="#check"/></svg> All example checks pass.</div><p class="recovery-caveat">Without sufficient evidence, recovery stays unverified.</p>`, caption: 'Fresh evidence, not an assumption.'}
  ] : [];
  let current = 0;
  const visited = new Set([0]);
  function showStage(index, focus = false) {
    current = (index + stages.length) % stages.length;
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === current)); tab.tabIndex = i === current ? 0 : -1; });
    panel.innerHTML = stages[current].html;
    panel.setAttribute('aria-labelledby', `step-${current}`);
    document.getElementById('stage-caption').textContent = stages[current].caption;
    const next = document.getElementById('next-stage');
    next.innerHTML = current === 2 ? `Restart ${arrow}` : `Next ${arrow}`;
    next.setAttribute('aria-label', current === 2 ? 'Restart resolution stages' : 'Next resolution stage');
    const shell = panel.closest('.workflow-window');
    shell.classList.remove('panel-enter');
    if (!motion.matches) requestAnimationFrame(() => shell.classList.add('panel-enter'));
    if (focus) tabs[current].focus();
    track('workflow_step_viewed', {step: current + 1});
    visited.add(current);
    if (visited.size === stages.length) { track('workflow_completed'); visited.clear(); }
  }
  if (panel) {
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => showStage(index));
      tab.addEventListener('keydown', event => {
        const keys = {ArrowDown:index+1,ArrowRight:index+1,ArrowUp:index-1,ArrowLeft:index-1,Home:0,End:2};
        if (event.key in keys) {event.preventDefault();showStage(keys[event.key], true);}
      });
    });
    document.getElementById('next-stage').addEventListener('click', () => showStage(current + 1));
    const updateOrientation = () => document.querySelector('.workflow-steps').setAttribute('aria-orientation', window.innerWidth <= 760 ? 'horizontal' : 'vertical');
    updateOrientation(); window.addEventListener('resize', updateOrientation, {passive:true});
  }
  document.querySelectorAll('[data-event]').forEach(el => el.addEventListener('click', () => track(el.dataset.event, {placement:el.dataset.placement || 'page'})));
  document.querySelectorAll('video').forEach(video => {
    let started = false; const milestones = new Set();
    video.addEventListener('play', () => { if (!started) {track('demo_video_started');started = true;} });
    video.addEventListener('timeupdate', () => {
      const percentage = video.duration > 0 ? video.currentTime / video.duration * 100 : 0;
      [25,50,75].forEach(value => { if (percentage >= value && !milestones.has(value)) {milestones.add(value);track('demo_video_progress',{percent:value});} });
    });
    video.addEventListener('ended', () => track('demo_video_completed'));
  });
  if ('IntersectionObserver' in window) {
    const seen = new Set();
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting && !seen.has(entry.target)) {seen.add(entry.target);track('section_viewed',{section:entry.target.dataset.section});} }), {threshold:.2});
    document.querySelectorAll('[data-section]').forEach(el => observer.observe(el));
    if (!motion.matches) {
      document.documentElement.classList.add('js-motion');
      const reveal = new IntersectionObserver(entries => entries.forEach(entry => {if(entry.isIntersecting){entry.target.classList.add('is-visible');reveal.unobserve(entry.target);}}),{threshold:.1,rootMargin:'0px 0px 20px 0px'});
      document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));
    }
  }
  motion.addEventListener('change', () => {if(motion.matches) document.documentElement.classList.remove('js-motion');});
  const menu = document.querySelector('.menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');
  if (menu && mobileNav) {
    function closeMenu(returnFocus = false) {menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');mobileNav.hidden = true;document.body.classList.remove('menu-open');if(returnFocus)menu.focus();}
    menu.addEventListener('click', () => {const open = menu.getAttribute('aria-expanded') !== 'true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');mobileNav.hidden = !open;});
    mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click',() => closeMenu()));
    document.addEventListener('keydown',e => {if(e.key==='Escape' && !mobileNav.hidden)closeMenu(true);});
    document.addEventListener('click',e => {if(!mobileNav.hidden && !e.target.closest('.site-header'))closeMenu();});
    window.addEventListener('resize',() => {if(window.innerWidth>760)closeMenu();},{passive:true});
  }
  const form = document.getElementById('early-access-form');
  if (form) {
    const status = document.getElementById('access-status');const button = form.querySelector('button[type=submit]');let submitting = false;
    form.addEventListener('focusin',() => track('access_form_started'),{once:true});
    form.addEventListener('submit',async event => {
      event.preventDefault();if(submitting || !form.reportValidity())return;
      submitting=true;button.disabled=true;button.setAttribute('aria-busy','true');status.classList.remove('error');status.textContent='Sending your request…';
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
      try {
        const response=await fetch('https://app.meldhq.net/api/early-access',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({email:form.elements.email.value.trim(),website:form.elements.website.value})});
        if(!response.ok)throw new Error('request_failed');
        form.reset();status.textContent='Thanks. Your request is in. A founder will reach out by email.';track('access_request_submitted');
      } catch(error) {status.classList.add('error');status.textContent='We couldn’t confirm your request. Please retry or email sricharanravi@meldhq.net.';track('access_request_failed',{reason:error.name==='AbortError'?'timeout':'request_failed'});}
      finally {clearTimeout(timeout);submitting=false;button.disabled=false;button.removeAttribute('aria-busy');}
    });
  }
  const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();
})();

// A single, pausable incident progression. No infinite loops or hidden evidence.
(() => {
  const preview=document.querySelector('.product-window');if(!preview)return;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const rows=[...preview.querySelectorAll('[data-scene]')];const steps=[...preview.querySelectorAll('[data-hero-step]')];
  const toggle=document.getElementById('preview-toggle');const status=document.getElementById('incident-status');
  let stage=3,timer,playing=false,started=false,inView=false;
  function render(){
    preview.dataset.heroStage=String(stage);preview.dataset.playing=String(playing);
    rows.forEach((row,i)=>{row.classList.toggle('is-current',i===stage);row.classList.toggle('is-pending',i>stage);});
    steps.forEach((step,i)=>{step.classList.toggle('is-current',i===stage);step.classList.toggle('is-complete',i<stage);step.setAttribute('aria-pressed',String(i===stage));});
    status.textContent=['Alert received','Investigating','Cause identified','Recovered'][stage];
    document.getElementById('diagnosis-copy').textContent=stage>=2?'Shared evidence pinpoints the error path. A leaked slot is exhausting capacity.':'Capacity is exhausted. Testing two leads: a traffic spike or leaked slots.';
    document.getElementById('chart-status').textContent=stage===3?'Recovery verified':'Recovery in focus';
    preview.querySelectorAll('.recovery-check>span:last-child').forEach((label,i)=>label.textContent=stage===3?(i===0?'Verified':'Healthy'):'Pending');
    toggle.textContent=playing?'Pause':stage===3?'Replay':'Play';
    toggle.setAttribute('aria-label',playing?'Pause illustrative incident animation':stage===3?'Replay illustrative incident animation':'Resume illustrative incident animation');
  }
  function schedule(){clearTimeout(timer);if(!playing||!inView||document.hidden)return;timer=setTimeout(()=>{stage++;if(stage>=3){stage=3;playing=false;}render();schedule();},stage===2?4200:3000);}
  function start(){started=true;stage=0;playing=true;render();schedule();}
  toggle.addEventListener('click',()=>{if(stage===3){start();return;}playing=!playing;render();schedule();});
  steps.forEach((button,index)=>{button.addEventListener('click',()=>{started=true;playing=false;stage=index;render();schedule();});button.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const next=(index+(e.key==='ArrowRight'?1:-1)+4)%4;steps[next].focus();steps[next].click();}});});
  motion.addEventListener('change',()=>{if(motion.matches){clearTimeout(timer);playing=false;stage=3;render();}});
  document.addEventListener('visibilitychange',schedule);
  render();
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;if(inView&&!started&&!motion.matches)start();else schedule();},{threshold:.25});observer.observe(preview);}else{inView=true;}
})();
