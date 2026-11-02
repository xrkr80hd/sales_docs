const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const state = [], effects = [], calls = [];
  let cursor = 0, mounted = false, directoryFails = false;
  const exports = {};
  const org = { id: 'kia', name: 'Walker Kia' };
  const account = { id: 'member', email: 'member@example.test', display_name: 'Member', role: 'user' };
  const dependencies = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
      },
      useCallback: fn => fn,
      useEffect: fn => { if (!mounted) effects.push(fn); },
    },
    'next/link': { default: 'a' },
    'lucide-react': new Proxy({}, { get: (_, key) => String(key) }),
    '@/components/ui/save-toast-host': { notifySave() {} },
    '@/components/command-center/organization-badge': { OrganizationBadge: 'badge' },
    '@/lib/organization-theme': { ORGANIZATION_THEMES: {} },
    '@/lib/workspace-roles': { ROLE_LABELS: { user: 'Consultant' }, WORKSPACE_ROLES: ['user'] },
    '@/lib/supabase-browser': { getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'test' } } }) } }) },
    '@/lib/request-json': {
      withDeadline: operation => Promise.resolve(operation),
      requestJson: async path => {
        calls.push(path);
        if (path === '/api/admin/users') return { users: [account], warnings: ['Cards temporarily unavailable'] };
        if (path === '/api/admin/invites') return { invites: [] };
        if (directoryFails) throw Error('Could not query the database for the schema cache. Retrying.');
        return { organizations: [org], memberships: [{ user_id: account.id, organization_id: org.id }] };
      },
    },
    './team-management.module.css': { default: new Proxy({}, { get: (_, key) => String(key) }) },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/admin/team-management.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => name in dependencies ? dependencies[name] : require(name), window: { localStorage: { getItem: () => null }, dispatchEvent() {} } });
  function render() { cursor = 0; const result = nodes(exports.TeamManagement()); mounted = true; return result; }
  return { render, calls, failDirectory: value => { directoryFails = value; }, async start() { render(); effects.forEach(fn => fn()); await tick(); }, async retry() { render().find(n => n.type === 'button' && String(n.props.children).includes('Retry loading')).props.onClick(); await tick(); } };
}

test('loading disables organization selection and account creation', () => {
  const h = harness();
  const tree = h.render();
  const picker = tree.find(n => n.type === 'select' && nodes(n).some(c => c.type === 'option' && c.props.children === 'Loading dealerships…'));
  assert.equal(picker.props.disabled, true);
  assert.equal(tree.find(n => n.type === 'button' && n.props.children === 'Create verified user').props.disabled, true);
});

test('directory failure leaves accounts visible and retries without creating users', async () => {
  const h = harness(); h.failDirectory(true); await h.start();
  let tree = h.render();
  assert(tree.some(n => n.props?.['aria-label'] === 'Accounts awaiting organization assignment'));
  assert(tree.some(n => typeof n.type === 'function' && n.props.user?.id === 'member'));
  assert(tree.some(n => n.type === 'option' && String(n.props.children).includes('Dealerships unavailable')));
  assert(tree.some(n => n.type === 'p' && String(n.props.children).includes('Cards temporarily unavailable')));
  h.failDirectory(false); await h.retry(); tree = h.render();
  const picker = tree.find(n => n.type === 'select' && nodes(n).some(c => c.type === 'option' && c.props.children === 'Choose a dealership'));
  assert.equal(picker.props.disabled, false);
  assert.equal(picker.props.value, '');
  assert(nodes(picker).some(n => n.type === 'option' && n.props.value === 'kia'));
  assert(!tree.some(n => n.props?.['aria-label'] === 'Accounts awaiting organization assignment'));
  assert.equal(h.calls.length, 6);
  assert(h.calls.every(path => path !== '/api/admin/workspace'));
});
