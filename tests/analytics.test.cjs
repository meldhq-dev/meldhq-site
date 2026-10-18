const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync('analytics.js', 'utf8');
function harness({consent, gpc = false, dnt, hostname = 'meldhq.net', blockedStorage = false} = {}) {
  const scripts = [], banners = [], events = [], options = [], withdrawals = [];
  const listeners = {};
  const values = new Map(consent ? [['meldhq.analytics-consent.v1', consent]] : []);
  const document = {
    title: 'MeldHQ', referrer: 'https://example.com/private/path?email=secret@example.com',
    head: {appendChild: node => scripts.push(node)},
    body: {appendChild: node => banners.push(node)},
    querySelectorAll: () => [],
    createElement: () => ({setAttribute() {}, addEventListener(name, handler) { this[name] = handler; }, remove() { this.removed = true; }})
  };
  const window = {
    MELD_ANALYTICS_CONFIG: {token: 'public-test-token', hosts: ['meldhq.net'], apiHost: 'https://us.i.posthog.com', assetHost: 'https://us-assets.i.posthog.com'},
    addEventListener: (name, handler) => listeners[name] = handler,
    posthog: {
      init(token, config) { options.push(config); config.loaded(this); },
      capture(event, properties) { const result = options[0].before_send({event, properties}); if (result) events.push(result); },
      opt_in_capturing() {}, opt_out_capturing(value) { withdrawals.push(value); }
    }
  };
  vm.runInNewContext(code, {window, document, navigator: {globalPrivacyControl:gpc, doNotTrack:dnt}, location: {hostname, host:hostname, origin:`https://${hostname}`, pathname:'/', search:'?utm_source=linkedin&utm_campaign=founders_oct&email=secret@example.com&token=secret#secret'}, URL, URLSearchParams, localStorage: {getItem: key => {if(blockedStorage) throw Error(); return values.get(key);}, setItem: (key,value) => {if(blockedStorage) throw Error(); values.set(key,value);}}});
  const choose = value => banners.at(-1).click({target: {closest: () => ({dataset: {consent:value}})}});
  const load = () => scripts.at(-1).onload();
  return {window,scripts,banners,events,options,withdrawals,choose,load,values,listeners};
}
test('no analytics network request or event before consent; explicit decline stays off', () => {
  const h=harness(); assert.equal(h.scripts.length,0); assert.equal(h.banners.length,1);
  h.window.meldAnalytics.track('demo_booking_clicked'); assert.equal(h.events.length,0);
  h.choose('denied'); assert.equal(h.scripts.length,0);
});
test('consent loads the SDK and records one pageview with attribution and no sensitive query', () => {
  const h=harness(); h.choose('allowed'); assert.equal(h.scripts.length,1); h.load();
  assert.equal(h.events.length,1); assert.equal(h.events[0].event,'$pageview');
  const p=h.events[0].properties;
  assert.equal(p.token,'public-test-token');
  assert.equal(p.utm_source,'linkedin'); assert.equal(p.$current_url,'https://meldhq.net/'); assert.equal(p.$referrer,'https://example.com/');
  assert.ok(!JSON.stringify(p).includes('secret'));
  assert.equal(h.options[0].autocapture,false); assert.equal(h.options[0].person_profiles,'never'); assert.equal(h.options[0].disable_session_recording,true);
});
test('custom events cannot leak email, arbitrary payloads, full URLs or person properties', () => {
  const h=harness({consent:'allowed'});h.load();
  h.window.meldAnalytics.track('access_request_submitted',{email:'secret@example.com',text:'secret', $set:{email:'secret'}, $current_url:'https://private/?secret', placement:'contact'});
  assert.equal(h.events.length,2); assert.equal(h.events[1].properties.placement,'contact'); assert.ok(!JSON.stringify(h.events).includes('secret'));
  h.window.meldAnalytics.track('unapproved_event',{secret:'secret'});assert.equal(h.events.length,2);
});
test('Global Privacy Control and Do Not Track override saved consent', () => {
  for(const privacy of [{gpc:true},{dnt:'1'}]) {const h=harness({consent:'allowed',...privacy});assert.equal(h.scripts.length,0);h.window.meldAnalytics.track('$pageview');assert.equal(h.events.length,0);}
});
test('withdrawal clears tracker persistence and stops future events', () => {
  const h=harness({consent:'allowed'});h.load();h.window.meldAnalytics.settings();h.choose('denied');h.window.meldAnalytics.track('demo_booking_clicked');assert.equal(h.events.length,1);assert.equal(h.withdrawals[0].clear_persistence,true);
});
test('withdrawal while SDK loads does not initialize or send events', () => {
  const h=harness();h.choose('allowed');h.window.meldAnalytics.settings();h.choose('denied');h.load();assert.equal(h.options.length,0);assert.equal(h.events.length,0);
});
test('local preview cannot contaminate production analytics', () => {const h=harness({hostname:'127.0.0.1',consent:'allowed'});assert.equal(h.scripts.length,0);});
test('storage denial does not break the page or start analytics without a choice', () => {const h=harness({blockedStorage:true});assert.equal(h.scripts.length,0);h.choose('allowed');h.load();assert.equal(h.events.length,1);});
test('revocation in another tab is respected', () => {const h=harness({consent:'allowed'});h.load();h.values.set('meldhq.analytics-consent.v1','denied');h.listeners.storage({key:'meldhq.analytics-consent.v1',newValue:'denied'});h.window.meldAnalytics.track('demo_booking_clicked');assert.equal(h.events.length,1);assert.equal(h.withdrawals.length,1);});
