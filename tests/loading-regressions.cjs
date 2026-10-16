const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { exports, require: name => { if (name in dependencies) return dependencies[name]; return require(name); }, Request, Response, URL, AbortController, setTimeout, clearTimeout, console, ...globals });
  return exports;
}
function account({ user = { id: 'member', email: 'member@example.test', app_metadata: {} }, authError = null, profileError = null, memberError = null, profile = { role: 'user', display_name: 'Member' }, brandingFails = false } = {}) {
  const queried = [], logs = [];
  let brandingCalls = 0;
  const data = { profiles: profile, organization_memberships: { organization_id: 'org', organizations: { name: 'Organization' } }, user_settings: { consultant_info: {} } };
  const db = { auth: { getUser: async () => ({ data: { user }, error: authError }) }, from(table) {
    const q = { select: () => q, eq: () => q, single: () => q, maybeSingle: () => q, then(resolve, reject) { queried.push(table); return Promise.resolve({ data: data[table], error: table === 'profiles' ? profileError : table === 'organization_memberships' ? memberError : null }).then(resolve, reject); } }; return q;
  } };
  const route = load('app/api/me/route.ts', {
    '@/lib/supabase-server': { getSupabaseServiceClient: () => db },
    '@/lib/organization-branding': { organizationBranding: async () => { brandingCalls++; if (brandingFails) throw Error('unavailable'); return {}; } },
    '@/lib/workspace-roles': { validWorkspaceRole: r => ['user', 'floor_manager'].includes(r), profileRole: r => r === 'floor_manager' ? 'sales_manager' : 'user' },
  }, { console: { error: (...v) => logs.push(v), warn: (...v) => logs.push(v) } });
  return { route, queried, logs, brandingCalls: () => brandingCalls };
}
const req = (query = '?access=1', token = true) => new Request('http://localhost/api/me' + query, { headers: token ? { authorization: 'Bearer test' } : {} });
test('startup returns authoritative identity without any branding or settings calls', async () => {
  const h = account({ brandingFails: true }); const response = await h.route.GET(req()); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.id, 'member'); assert.equal(body.mustChangePassword, false);
  assert.equal(h.brandingCalls(), 0); assert.deepEqual(h.queried.sort(), ['organization_memberships', 'profiles']); assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('password change remains mandatory and does not start workspace queries', async () => {
  const h = account({ user: { id: 'member', app_metadata: { must_change_password: true } } }); const response = await h.route.GET(req());
  assert.deepEqual(await response.json(), { mustChangePassword: true }); assert.equal(h.queried.length, 0);
});
test('missing tokens, expired sessions and missing profiles cannot pass startup', async () => {
  assert.equal((await account().route.GET(req('', false))).status, 401);
  assert.equal((await account({ user: null, authError: { status: 401 } }).route.GET(req())).status, 401);
  assert.equal((await account({ profile: null }).route.GET(req())).status, 403);
});
test('service failure is recoverable and is not mislabeled an expired session', async () => {
  const response = await account({ user: null, authError: { status: 503 } }).route.GET(req()); assert.equal(response.status, 503); assert.match((await response.json()).error, /temporarily unavailable/);
});
test('workspace errors return JSON and never substitute a default role', async () => {
  const h = account({ profileError: { message: 'database unavailable' } }); const response = await h.route.GET(req()); assert.equal(response.status, 503); assert((await response.json()).error); assert.equal(h.logs[0][1].stage, 'workspace');
});
test('untrusted user metadata cannot grant manager permissions', async () => {
  const h = account({ user: { id: 'member', email: 'member@example.test', app_metadata: {}, user_metadata: { workspace_role: 'floor_manager' } } }); assert.equal((await (await h.route.GET(req())).json()).workspaceRole, 'user');
});
const json = fetch => load('lib/request-json.ts', {}, { fetch });
test('JSON request deadline covers stalled fetch and body, and aborts both', async () => {
  for (const bodyStalls of [false, true]) { let signal; const h = json(async (_, options) => { signal = options.signal; return bodyStalls ? { ok: true, json: () => new Promise(() => {}) } : new Promise(() => {}); });
    await assert.rejects(h.requestJson('/api/me', {}, 10), /too long/); assert(signal.aborted);
  }
});
test('mutation timeout requires checking saved state and never retries automatically', async () => {
  let calls = 0; const h = json(() => { calls++; return new Promise(() => {}); }); await assert.rejects(h.requestJson('/api/manager-board', { method: 'POST' }, 10), /check whether it saved/); assert.equal(calls, 1);
});
test('invalid JSON and server errors produce a usable failure', async () => {
  await assert.rejects(json(async () => ({ ok: true, json: async () => { throw Error('HTML'); } })).requestJson('/api/me'), /invalid response/);
  await assert.rejects(json(async () => ({ ok: false, status: 403, json: async () => ({ error: 'Access denied' }) })).requestJson('/api/me'), /Access denied/);
});
test('session restoration has a deadline as well', async () => { await assert.rejects(json(() => {}).withDeadline(new Promise(() => {}), 'Session stalled', 10), /Session stalled/); });
function nodes(node) { if (!node || typeof node !== 'object') return []; return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)]; }
function notification({ request = async () => 'granted', subscription = () => new Promise(() => {}) } = {}) {
  let visible = true, dismissed = false;
  const ui = load('components/ui/notification-prompt.tsx', {
    react: { useState: () => [visible, v => { visible = v; }], useEffect: () => {} },
    '@/lib/notifications': { getPermission: () => 'default', notificationsSupported: () => true, requestPermission: request, setDismissed: () => { dismissed = true; }, subscribeToPush: subscription, wasDismissed: () => dismissed },
    '@/lib/supabase-browser': { getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'test' } } }) } }) },
  });
  return { allow: nodes(ui.NotificationPrompt()).find(n => n.type === 'button').props.onClick, visible: () => visible, dismissed: () => dismissed };
}
test('Allow closes the notification prompt before a stalled push registration completes', async () => { const h = notification(); void h.allow(); assert.equal(h.visible(), false); assert.equal(h.dismissed(), true); });
test('permission rejection also leaves the prompt dismissed', async () => { const h = notification({ request: async () => { throw Error('Unsupported'); } }); await h.allow(); assert.equal(h.visible(), false); });
test('own message controls start hidden and reveal on tap without adding a sender heading', () => {
  let toggled = 0; const { MessageBubble } = load('components/messenger/message-bubble.tsx', { './organization-messenger.module.css': { default: new Proxy({}, { get: (_, key) => String(key) }) } }, { window: { getSelection: () => ({ toString: () => '' }) } });
  const props = { message: { id: 1, body: 'Hello!', created_at: '2026-10-16T12:00:00Z' }, own: true, senderName: 'Me', expanded: false, confirmingDelete: false, busy: false, onToggle: () => toggled++ };
  let tree = nodes(MessageBubble(props)); const bubble = tree.find(n => n.type === 'button' && n.props['aria-controls']);
  assert.equal(bubble.props['aria-expanded'], false); bubble.props.onClick(); assert.equal(toggled, 1);
  assert.equal(tree.find(n => n.props?.id === 'message-actions-1').props.hidden, true); assert(!tree.some(n => n.type === 'strong'));
  tree = nodes(MessageBubble({ ...props, expanded: true })); assert.equal(tree.find(n => n.props?.id === 'message-actions-1').props.hidden, false);
});
function brandingHarness() {
  const module = load('lib/organization-branding.ts', { '@/lib/supabase-server': {} });
  function client(deleted = false, failFirst = false) {
    let reads = 0;
    const db = { auth: { admin: { listUsers: async () => ({ data: { users: [{ id: 'owner', email: 'xrkr80hd@gmail.com' }] }, error: null }) } }, from() {
      const q = { select: () => q, eq: () => q, maybeSingle: () => q, then(resolve, reject) { reads++; return Promise.resolve({ data: { user_id: 'owner', dealer_info: { organizationBranding: { org: deleted ? { deletedAt: '2026-10-16' } : {} } } }, error: failFirst && reads === 1 ? Error('temporary') : null }).then(resolve, reject); } }; return q;
    } }; return { db, reads: () => reads };
  }
  return { ...module, client };
}
test('branding and board share one settings read per request, without stale deletion flags on the next request', async () => {
  const h = brandingHarness(); const first = h.client(); await Promise.all([h.organizationBranding(first.db), h.organizationSettings(first.db)]); assert.equal(first.reads(), 1);
  const next = h.client(true); const brands = await h.organizationBranding(next.db); assert.equal(next.reads(), 1); assert.equal(brands.org.deletedAt, '2026-10-16');
});
test('a failed settings lookup can be retried on the same client', async () => { const h = brandingHarness(), c = h.client(false, true); await assert.rejects(h.organizationSettings(c.db), /temporary/); await h.organizationSettings(c.db); assert.equal(c.reads(), 2); });
