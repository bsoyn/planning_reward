/* 반복 기간(v5) 스모크 테스트 — 순수 로직만 로드해서 검증. node test-range.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const store = {};
const ctx = {
  console,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
  },
  Date, Math, JSON, Object, Array, String, Number
};
ctx.window = ctx;
vm.createContext(ctx);

['core/utils.js', 'core/store.js', 'services/points.js', 'services/schedule.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'src', f), 'utf8'), ctx, { filename: f });
});
const PR = ctx.PR;

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return PR.todayStr(d); }
const today = PR.todayStr();

console.log('\n[1] isScheduledOn — 반복 기간 경계');
const daily = { id: 'a', kind: 'routine', active: true, freq: { type: 'days', days: [] }, startDate: daysAgo(3), endDate: daysAgo(1) };
ok('시작일 이전은 예정 아님', PR.sched.isScheduledOn(daily, daysAgo(4)) === false);
ok('시작일 당일은 예정', PR.sched.isScheduledOn(daily, daysAgo(3)) === true);
ok('종료일 당일은 예정', PR.sched.isScheduledOn(daily, daysAgo(1)) === true);
ok('종료일 이후는 예정 아님', PR.sched.isScheduledOn(daily, today) === false);
ok('isExpired', PR.sched.isExpired(daily) === true);

const open = { id: 'b', kind: 'routine', active: true, freq: { type: 'days', days: [] }, startDate: '', endDate: '' };
ok('기간 비우면 무제한', PR.sched.isScheduledOn(open, daysAgo(999)) === true);

const weekly = { id: 'c', kind: 'routine', active: true, freq: { type: 'weekly', n: 3 }, startDate: daysAgo(2), endDate: '' };
ok('주 n회형도 시작일 이전 제외', PR.sched.isScheduledOn(weekly, daysAgo(5)) === false);
ok('주 n회형 기간 내는 노출', PR.sched.isScheduledOn(weekly, today) === true);

console.log('\n[2] v4 → v5 마이그레이션');
const v4 = {
  v: 4, points: 0, earned: 0, bestStreak: 0, freezes: 1, freezeMark: 0, frozenDates: [], lastReconcile: today, penaltyOn: true,
  plans: [
    { id: 'p1', kind: 'routine', active: true, freq: { type: 'days', days: [] }, createdAt: daysAgo(10) },
    { id: 'p2', kind: 'habit', active: true, freq: { type: 'days', days: [] }, createdAt: daysAgo(5) },   // 기록이 생성일보다 앞섬
    { id: 'p3', kind: 'habit', active: true, freq: { type: 'days', days: [] }, createdAt: '' },           // v1 출신
    { id: 'p4', kind: 'deadline', active: true, deadline: today, createdAt: daysAgo(2) }
  ],
  logs: [{ id: 'l1', planId: 'p2', date: daysAgo(20), full: true }],
  projects: [], rewards: [], purchases: []
};
const m = PR.store.normalize(JSON.parse(JSON.stringify(v4)));
const byId = id => m.plans.find(p => p.id === id);
ok('버전 5', m.v === 5);
ok('생성일이 시작일로', byId('p1').startDate === daysAgo(10));
ok('생성일보다 이른 기록이 있으면 그 날짜로', byId('p2').startDate === daysAgo(20));
ok('과거 기록이 달력에서 사라지지 않음', PR.sched.isScheduledOn(byId('p2'), daysAgo(20)) === true);
ok('생성일 없으면 무제한 유지', byId('p3').startDate === '');
ok('종료일은 비어 있음', m.plans.every(p => p.endDate === ''));
ok('마감형도 필드 보유', byId('p4').startDate === '' && byId('p4').endDate === '');

console.log('\n[3] 새 계획 추가가 과거 스트릭을 끊지 않음');
/* 기존 계획은 평일(월~금)만 예정 — 주말은 "예정 없는 휴식일"이라 스트릭에 중립.
   여기에 매일 반복 계획을 새로 추가하면, 반복 기간이 없던 예전 동작에서는
   지난 주말이 "놓친 예정일"로 바뀌어 스트릭이 끊긴다. */
const weekdayLogs = [];
for (let i = 1; i <= 20; i++) {
  const d = new Date(); d.setDate(d.getDate() - i);
  const wd = d.getDay();
  if (wd >= 1 && wd <= 5) weekdayLogs.push({ id: 'g' + i, planId: 'old', date: PR.todayStr(d), full: true, duty: false });
}
PR.store.state = PR.store.normalize({
  v: 5, points: 0, earned: 0, bestStreak: 0, freezes: 1, freezeMark: 0, frozenDates: [], lastReconcile: today, penaltyOn: true,
  plans: [{ id: 'old', title: '기존', kind: 'routine', duty: false, basePts: 30, active: true, freq: { type: 'days', days: [1, 2, 3, 4, 5] }, startDate: daysAgo(20), endDate: '' }],
  logs: weekdayLogs,
  projects: [], rewards: [], purchases: []
});
const before = PR.points.computeStreak(false);
ok('기존 스트릭이 주말을 건너뛰고 쌓임 (' + before + '일)', before === weekdayLogs.length);

const fresh = { id: 'new', title: '오늘 추가', kind: 'routine', duty: false, basePts: 30, active: true, freq: { type: 'days', days: [] }, startDate: today, endDate: '' };
PR.store.state.plans.push(fresh);
ok('오늘 만든 매일 계획을 추가해도 스트릭 유지', PR.points.computeStreak(false) === before);

fresh.startDate = ''; // 반복 기간이 없던 예전 동작 재현
ok('(대조) 기간이 없으면 지난 주말이 놓친 날이 되어 끊김', PR.points.computeStreak(false) < before);

console.log('\n[4] planStreak — 기간 이전에서 멈춤');
PR.store.state.plans = [PR.store.state.plans[0]];
ok('planStreak가 기록 수와 일치', PR.sched.planStreak(PR.store.state.plans[0]).n === weekdayLogs.length);

console.log('\n' + (fail ? '실패 ' + fail + '건 / ' : '') + '통과 ' + pass + '건');
process.exit(fail ? 1 : 0);
