const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

function loadSource(relativePath, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, loaded, loaded.exports);
  return loaded.exports;
}

const { mobileFeatures, canAccessFeature } = loadSource('src/features/registry.ts', {
  '@/services/workspace.service': { workspaceService: new Proxy({}, { get: () => async () => ({}) }) },
});
const feature = (slug) => {
  const found = mobileFeatures.find((item) => item.slug === slug);
  assert.ok(found, `Feature missing: ${slug}`);
  return found;
};
const user = (role, department = '', extra = {}) => ({ roles: [role], organization_department: department, ...extra });

test('optional department matches accept either a role or department', () => {
  assert.equal(canAccessFeature(feature('products'), user('ADMIN', 'HR')), true);
  assert.equal(canAccessFeature(feature('products'), user('EMPLOYEE', 'PRODUCT')), true);
  assert.equal(canAccessFeature(feature('products'), user('CUSTOMER')), false);
});

test('required department rules do not accept unrelated contributors', () => {
  assert.equal(canAccessFeature(feature('sales'), user('EMPLOYEE', 'SALES')), true);
  assert.equal(canAccessFeature(feature('sales'), user('EMPLOYEE', 'HR')), false);
});

test('explicit grants and system HR reach authorized workspaces', () => {
  assert.equal(canAccessFeature(feature('sales'), user('EMPLOYEE', 'HR', { permissions: ['SALES_DASHBOARD_VIEW'] })), true);
  assert.equal(canAccessFeature(feature('onboarding'), user('EMPLOYEE', '', { system_roles: ['HR'] })), true);
  assert.equal(canAccessFeature(feature('recruitment-admin'), user('EMPLOYEE', '', { permissions: ['RECRUITMENT_REVIEW'] })), true);
  assert.equal(canAccessFeature(feature('recruitment-admin'), user('EMPLOYEE')), false);
});

test('signed-out users cannot access any workspace', () => {
  for (const item of mobileFeatures) assert.equal(canAccessFeature(item, null), false);
});

test('every registered feature has a screen or data loader', () => {
  assert.equal(new Set(mobileFeatures.map((item) => item.slug)).size, mobileFeatures.length);
  const source = fs.readFileSync(path.join(__dirname, '../src/app/(app)/feature/[slug].tsx'), 'utf8');
  const parsed = ts.createSourceFile('feature.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const screens = new Set();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'screens') {
      for (const property of node.initializer.properties) screens.add(property.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  for (const item of mobileFeatures) assert.ok(screens.has(item.slug) || item.load, `${item.slug} has no implementation`);
});

test('recruitment status updates use the server POST contract', async () => {
  const requests = [];
  const { recruitmentService } = loadSource('src/services/recruitment.service.ts', {
    'expo-document-picker': {},
    '@/services/api': { api: { post: async (...args) => { requests.push(args); return { data: { success: true } }; } } },
  });
  await recruitmentService.setOpportunityStatus('opening-123', 'PUBLISHED');
  assert.deepEqual(requests, [['/recruitment/admin/opportunities/opening-123/status', { status: 'PUBLISHED' }]]);
});

test('native startup does not import LiveKit when WebRTC is absent', async () => {
  for (const WebRTCModule of [null, undefined]) {
    const setup = loadSource('src/lib/livekit-setup.native.ts', {
      'react-native': { NativeModules: { WebRTCModule } },
    });
    assert.equal(setup.nativeCallsAvailable, false);
    await setup.nativeCallsReady;
  }
});

test('native startup registers LiveKit globals when WebRTC is installed', async () => {
  let registrations = 0;
  const setup = loadSource('src/lib/livekit-setup.native.ts', {
    'react-native': { NativeModules: { WebRTCModule: {} } },
    '@livekit/react-native': { registerGlobals: () => { registrations += 1; } },
  });
  assert.equal(setup.nativeCallsAvailable, true);
  await setup.nativeCallsReady;
  assert.equal(registrations, 1);
});

test('Expo Go selects the unsupported provider without importing native calls', () => {
  const fallback = () => null;
  const provider = loadSource('src/providers/runtime-call-provider.native.tsx', {
    react: { lazy: () => assert.fail('Native provider must not be loaded in Expo Go') },
    '@/lib/livekit-setup': { nativeCallsAvailable: false },
    './CallProvider.web': { CallProvider: fallback },
  });
  assert.equal(provider.CallProvider, fallback);
});

test('a WebRTC-enabled build selects the native call provider after globals register', async () => {
  const native = () => null;
  const lazyProvider = () => null;
  let loadNative;
  let registered = false;
  const provider = loadSource('src/providers/runtime-call-provider.native.tsx', {
    react: { lazy: (loader) => { loadNative = loader; return lazyProvider; } },
    '@/lib/livekit-setup': { nativeCallsAvailable: true, nativeCallsReady: Promise.resolve().then(() => { registered = true; }) },
    './CallProvider.web': { CallProvider: () => null },
    get './CallProvider.native'() { assert.equal(registered, true); return { CallProvider: native }; },
  });
  assert.equal(provider.CallProvider, lazyProvider);
  const loaded = await loadNative();
  assert.equal(loaded.default, native);
});

const dashboard = loadSource('src/features/dashboard-model.ts', {});

test('chat and chat activity routes render without dashboard navigation', () => {
  for (const pathname of ['/chat', '/chat/conversation-1', '/feature/chat', '/feature/calls', '/feature/statuses']) {
    assert.equal(dashboard.isStandaloneChatRoute(pathname), true);
  }
  for (const pathname of ['/', '/profile', '/workspace', '/feature/tasks', '/feature/assistant']) {
    assert.equal(dashboard.isStandaloneChatRoute(pathname), false);
  }
});

test('dashboard role precedence matches executive and department website routing', () => {
  assert.equal(dashboard.dashboardKind(user('ADMIN', 'SALES')), 'executive');
  assert.equal(dashboard.dashboardKind(user('ADMIN'), 'SALES'), 'sales');
  assert.equal(dashboard.dashboardKind(user('CEO'), 'PRODUCT'), 'workflow');
  assert.equal(dashboard.dashboardKind(user('SALES_MANAGER', 'SALES')), 'executive');
  assert.equal(dashboard.dashboardKind(user('EMPLOYEE', 'SALES')), 'sales');
  assert.equal(dashboard.dashboardKind(user('EMPLOYEE', 'MARKETING')), 'marketing');
  assert.equal(dashboard.dashboardKind(user('INTERN', 'ENGINEERING')), 'personal');
});

test('dashboard metrics use website statuses and sort deadlines without mutating tasks', () => {
  const tasks = [
    { _id: 'later', title: 'Later', deadline: '2026-10-10', status: 'PENDING', effectiveStatus: 'PENDING' },
    { _id: 'done', title: 'Done', deadline: '2026-10-01', status: 'DONE', effectiveStatus: 'DONE' },
    { _id: 'earlier', title: 'Earlier', deadline: '2026-10-02', status: 'PENDING', effectiveStatus: 'DELAYED' },
  ];
  const result = dashboard.dashboardMetrics(tasks, { summary: { present: 4 }, today: { openSession: { checkIn: '2026-10-05T09:00:00Z' } } }, [{ status: 'PENDING' }, { status: 'APPROVED' }]);
  assert.equal(result.active.length, 2);
  assert.equal(result.completed, 1);
  assert.equal(result.delayed, 1);
  assert.equal(result.completionRate, '33%');
  assert.equal(result.present, 4);
  assert.equal(result.pendingLeave, 1);
  assert.equal(result.checkedIn, true);
  assert.deepEqual(result.upcoming.map((task) => task._id), ['earlier', 'later']);
  assert.equal(tasks[0]._id, 'later');
  assert.equal(dashboard.dashboardMetrics([], null, []).completionRate, '--');
});

test('dashboard greeting matches website day and night boundaries', () => {
  for (const [hour, expected] of [[4, 'Good night'], [5, 'Good morning'], [12, 'Good afternoon'], [17, 'Good evening'], [21, 'Good night']]) {
    assert.equal(dashboard.greetingFor(new Date(2026, 9, 5, hour)), expected);
  }
});

test('personal leave and department workflow requests match website API scoping', async () => {
  const requests = [];
  const { workspaceService } = loadSource('src/services/workspace.service.ts', {
    '@/services/api': { api: { get: async (...args) => { requests.push(args); return { data: {} }; } } },
  });
  await workspaceService.personalLeave();
  await workspaceService.workflowTasks('ENGINEERING');
  assert.deepEqual(requests, [
    ['/leave', { params: { scope: 'self' } }],
    ['/tasks/workflow', { params: { department: 'ENGINEERING' } }],
  ]);
});

const organization = loadSource('src/features/organization-model.ts', {});
const taskModel = loadSource('src/features/task-model.ts', {});

test('organization filters retain reporting ancestors and chart connectors', () => {
  const assignment = (id, level, parent, department = 'ENGINEERING') => ({ _id: id, userId: { _id: id, name: id, email: `${id}@example.test`, roles: ['EMPLOYEE'] }, level, department, roleKeys: [], reportsTo: parent ? { _id: parent, name: parent } : null, active: true });
  const items = [assignment('ceo', 'CEO', null, 'PRODUCT'), assignment('head', 'HEAD', 'ceo'), assignment('manager', 'MANAGER', 'head'), assignment('member', 'MEMBER', 'manager')];
  const forest = organization.organizationForest(items, 'ENGINEERING', 'member');
  assert.equal(forest[0].item.userId._id, 'ceo');
  assert.equal(forest[0].children[0].children[0].children[0].item.userId._id, 'member');
  const chart = organization.layoutOrganization(forest, new Set());
  assert.equal(chart.nodes.length, 4);
  assert.equal(chart.edges.length, 4);
  const collapsed = organization.layoutOrganization(forest, new Set(['head']));
  assert.equal(collapsed.nodes.length, 2);
  assert.ok(chart.nodes.every(node => node.x >= 0 && node.x + chart.nodeWidth <= chart.width));
});

test('organization cycles do not recurse indefinitely or lose people', () => {
  const items = ['one', 'two'].map((id, index) => ({ _id: id, userId: { _id: id, name: id, email: '', roles: [] }, level: 'MEMBER', department: 'PRODUCT', roleKeys: [], reportsTo: { _id: index ? 'one' : 'two', name: '' }, active: true }));
  const chart = organization.layoutOrganization(organization.organizationForest(items), new Set());
  assert.equal(chart.nodes.length, 2);
});

test('contributor board stages match the website and enhancement history is immutable', () => {
  const task = { status: 'PENDING', workflowStage: 'ASSIGNED', workflowHistory: [{ action: 'ASSIGNED', createdAt: '2026-10-01' }, { action: 'ENHANCEMENT_REQUESTED', note: 'Fix delivery', createdAt: '2026-10-02' }] };
  assert.equal(taskModel.taskColumn(task), 'Enhancement');
  assert.equal(taskModel.taskColumn({ ...task, workflowHistory: [] }), 'Assigned');
  assert.equal(taskModel.taskColumn({ ...task, workflowStage: 'SUBMITTED' }), 'Submitted');
  assert.equal(taskModel.taskColumn({ ...task, workflowStage: 'COMPLETED' }), 'Accepted');
  assert.equal(task.workflowHistory[0].action, 'ASSIGNED');
});

test('on-time filter requires completed work delivered by its deadline', () => {
  const task = { effectiveStatus: 'DONE', completedAt: '2026-10-02T10:00:00Z', deadline: '2026-10-02T12:00:00Z' };
  assert.equal(taskModel.reportTaskMatches(task, 'ON_TIME'), true);
  assert.equal(taskModel.reportTaskMatches({ ...task, completedAt: '2026-10-03' }, 'ON_TIME'), false);
  assert.equal(taskModel.reportTaskMatches({ ...task, completedAt: null }, 'ON_TIME'), false);
});

test('contribution grid covers 84 days and uses maximum daily progress', () => {
  const reports = [{ reportDate: '2026-10-06', progress: 20 }, { reportDate: '2026-10-06T09:00:00Z', progress: 90 }];
  const days = taskModel.contributionDays(reports, new Date('2026-10-06T12:00:00Z'));
  assert.equal(days.length, 84);
  assert.equal(days.at(-1).entries.length, 2);
  assert.equal(days.at(-1).progress, 90);
  assert.equal(days.at(-1).tone, 3);
  assert.equal(days[0].tone, 0);
});

test('team report filtering, delivery URLs, and delegation use website API payloads', async () => {
  const requests = [];
  const api = Object.fromEntries(['get', 'post', 'patch'].map(method => [method, async (...args) => { requests.push([method, ...args]); return { data: {} }; }]));
  const { workspaceService } = loadSource('src/services/workspace.service.ts', { '@/services/api': { api } });
  await workspaceService.adminTaskReport('Ada', { department: 'ENGINEERING', page: 2, pageSize: 5, status: 'ON_TIME' });
  await workspaceService.submitTask('task-1', 'A complete delivery description', { githubUrl: 'https://github.com/example/project' });
  await workspaceService.delegateWorkflowTask('parent-1', [{ title: 'Implement', description: 'Implement delivery', deadline: '2026-10-20', assignedToIds: ['member-1'] }]);
  assert.deepEqual(requests[0], ['get', '/tasks/admin/report', { params: { department: 'ENGINEERING', page: 2, pageSize: 5, status: 'ON_TIME', search: 'Ada' } }]);
  assert.equal(requests[1][2].githubUrl, 'https://github.com/example/project');
  assert.equal(requests[1][2].status, 'DONE');
  assert.equal(requests[2][1], '/tasks/workflow/parent-1/subtasks');
  assert.equal(requests[2][2].subtasks[0].assignedToIds[0], 'member-1');
});