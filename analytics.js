'use strict';
(() => {
  const config = window.MELD_ANALYTICS_CONFIG;
  const preferenceKey = 'meldhq.analytics-consent.v1';
  const protectedByBrowser = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  let memoryPreference;
  let loading = false;
  let initialized = false;
  let pageCaptured = false;
  let banner;
  const allowedEvents = new Set(['$pageview', '$pageleave', 'demo_booking_clicked', 'workflow_opened', 'workflow_step_viewed', 'workflow_completed', 'demo_video_started', 'demo_video_progress', 'demo_video_completed', 'section_viewed', 'access_form_started', 'access_request_submitted', 'access_request_failed', 'app_opened', 'pitch_deck_opened', 'overview_opened', 'contact_email_clicked']);
  const allowedProperties = new Set(['distinct_id', '$device_id', '$session_id', '$window_id', '$lib', '$lib_version', '$browser', '$browser_version', '$os', '$os_version', '$device_type', '$screen_height', '$screen_width', '$viewport_height', '$viewport_width', '$browser_language', '$browser_language_prefix', '$time', '$insert_id', '$is_identified', '$process_person_profile', '$event_type', '$pageview_id', '$prev_pageview_id', '$prev_pageview_duration', 'placement', 'step', 'percent', 'section', 'reason', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content']);
  function preference() {
    try { return localStorage.getItem(preferenceKey) || memoryPreference; } catch { return memoryPreference; }
  }
  function allowed() { return !protectedByBrowser && preference() === 'allowed'; }
  function store(value) { memoryPreference = value; try { localStorage.setItem(preferenceKey, value); } catch { /* Private browsers can deny storage. */ } }
  function referrer() {
    try { const url = new URL(document.referrer); return /^https?:$/.test(url.protocol) ? {url: url.origin + '/', domain: url.hostname} : {url: '', domain: '$direct'}; } catch { return {url: '', domain: '$direct'}; }
  }
  function campaign() {
    const params = new URLSearchParams(location.search);
    const result = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(key => {
      const value = params.get(key);
      // Campaign labels only: never emails, free-form URLs, tokens or recipient IDs.
      if (value && /^[a-zA-Z0-9_-]{1,64}$/.test(value)) result[key] = value;
    });
    return result;
  }
  function sanitize(event) {
    if (!allowed() || !event || !allowedEvents.has(event.event)) return null;
    const properties = {};
    Object.entries(event.properties || {}).forEach(([key, value]) => { if (allowedProperties.has(key)) properties[key] = value; });
    const source = referrer();
    event.properties = {...properties, token: config.token, ...campaign(), $current_url: location.origin + location.pathname, $pathname: location.pathname, $host: location.host, $title: document.title, $referrer: source.url, $referring_domain: source.domain, $process_person_profile: false};
    return event;
  }
  function track(event, properties = {}) {
    if (!allowed() || !initialized || !allowedEvents.has(event)) return;
    window.posthog.capture(event, properties);
  }
  function init() {
    if (!allowed() || !config?.token || !config.hosts.includes(location.hostname)) return;
    if (initialized) { window.posthog.opt_in_capturing({enable_persistence: true}); if (!pageCaptured) { track('$pageview'); pageCaptured = true; } return; }
    if (loading) return;
    loading = true;
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = config.assetHost + '/static/array.js';
    script.onerror = () => { loading = false; };
    script.onload = () => {
      loading = false;
      if (!allowed() || !window.posthog?.init) return;
      window.posthog.init(config.token, {
        api_host: config.apiHost, ui_host: 'https://us.posthog.com', defaults: '2026-05-30',
        autocapture: false, capture_pageview: false, capture_pageleave: false,
        capture_dead_clicks: false, rageclick: false, capture_heatmaps: false,
        capture_performance: false, capture_exceptions: false,
        disable_session_recording: true, disable_surveys: true, advanced_disable_flags: true,
        person_profiles: 'never', persistence: 'localStorage', cross_subdomain_cookie: false,
        respect_dnt: true, before_send: sanitize,
        loaded: client => {
          initialized = true;
          if (!allowed()) { client.opt_out_capturing({clear_persistence: true}); return; }
          if (!pageCaptured) { track('$pageview'); pageCaptured = true; }
        }
      });
    };
    document.head.appendChild(script);
  }
  function closeBanner() { banner?.remove(); banner = null; }
  function choose(value) {
    store(value);
    closeBanner();
    if (value === 'allowed') init();
    else if (initialized) window.posthog.opt_out_capturing({clear_persistence: true});
  }
  function settings() {
    if (banner) { banner.querySelector('button')?.focus(); return; }
    banner = document.createElement('section');
    banner.className = 'consent';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Website analytics preferences');
    if (protectedByBrowser) {
      banner.innerHTML = '<h2>Analytics are off</h2><p>We respect your browser’s privacy signal. No website analytics are collected.</p><button class="button" data-consent="close">Got it</button>';
    } else {
      banner.innerHTML = '<h2>Help us improve MeldHQ’s website?</h2><p>Allow analytics for visits, traffic sources and demo interest. No session recordings or form contents. <a href="/privacy.html">Details</a></p><div class="consent-actions"><button class="button" data-consent="allowed">Allow analytics</button><button class="button secondary" data-consent="denied">No thanks</button></div>';
    }
    banner.addEventListener('click', event => { const choice = event.target.closest('[data-consent]'); if (!choice) return; choice.dataset.consent === 'close' ? closeBanner() : choose(choice.dataset.consent); });
    document.body.appendChild(banner);
  }
  window.meldAnalytics = Object.freeze({track, settings});
  document.querySelectorAll('[data-analytics-settings]').forEach(button => button.addEventListener('click', settings));
  // A preference changed in another tab must immediately apply here too.
  window.addEventListener('storage', event => { if (event.key === preferenceKey) { memoryPreference = event.newValue; if (!allowed() && initialized) window.posthog.opt_out_capturing({clear_persistence: true}); else if (allowed()) init(); closeBanner(); } });
  window.addEventListener('pagehide', () => track('$pageleave'));
  if (allowed()) init();
  else if (!protectedByBrowser && !preference() && config?.token && config.hosts.includes(location.hostname)) settings();
})();
