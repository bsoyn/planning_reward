/* 회귀 테스트 — DOM 없이 순수 로직만 로드해서 검증. node test.js
   [1~4] 반복 기간(v5)  [5~6] 보상 1회성/다회성 + 사용권 티켓(v6) */
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
  document: { getElementById: () => null },   // PR.toast는 토스트 요소가 없으면 조용히 반환
  setTimeout, clearTimeout,
  Date, Math, JSON, Object, Array, String, Number
};
ctx.window = ctx;
vm.createContext(ctx);

['core/utils.js', 'core/store.js', 'services/points.js', 'services/schedule.js', 'services/actions.js'].forEach(f => {
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

console.log('\n[2] v4 데이터 → 반복 기간 마이그레이션');
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
ok('최신 버전까지 연쇄 마이그레이션', m.v === 6);
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

console.log('\n[5] v5 → v6 보상/사용권 마이그레이션');
const v5 = {
  v: 5, points: 500, earned: 500, bestStreak: 0, freezes: 1, freezeMark: 0, frozenDates: [], lastReconcile: today, penaltyOn: true,
  plans: [], logs: [], projects: [],
  rewards: [{ id: 'r1', name: '치킨', cost: 100 }],
  purchases: [{ id: 'x1', name: '치킨', cost: 100, date: daysAgo(3) }]
};
const m6 = PR.store.normalize(JSON.parse(JSON.stringify(v5)));
ok('버전 6', m6.v === 6);
ok('기존 보상은 다회성', m6.rewards[0].once === false);
ok('기존 구매는 사용 완료로', m6.purchases[0].used === true);
ok('이름으로 rewardId 연결', m6.purchases[0].rewardId === 'r1');
ok('미사용 티켓이 새로 생기지 않음', m6.purchases.filter(p => !p.used).length === 0);

console.log('\n[6] 1회성 소진은 티켓 유무에서 파생');
PR.store.state = PR.store.normalize({
  v: 6, points: 1000, earned: 1000, bestStreak: 0, freezes: 1, freezeMark: 0, frozenDates: [], lastReconcile: today, penaltyOn: true,
  plans: [], logs: [], projects: [],
  rewards: [{ id: 'once1', name: '한번만', cost: 100, once: true }, { id: 'many1', name: '여러번', cost: 50, once: false }],
  purchases: []
});
const S = () => PR.store.state;
const rOnce = () => S().rewards[0], rMany = () => S().rewards[1];

ok('처음엔 소진 아님', PR.actions.isSoldOut(rOnce()) === false);
PR.actions.buyReward('once1');
ok('1회성 구매 후 소진', PR.actions.isSoldOut(rOnce()) === true);
ok('포인트 차감', S().points === 900);
PR.actions.buyReward('once1');
ok('1회성 재구매 차단', S().purchases.length === 1 && S().points === 900);

PR.actions.buyReward('many1');
PR.actions.buyReward('many1');
ok('다회성은 여러 장 발급', S().purchases.filter(p => p.rewardId === 'many1').length === 2);
ok('다회성은 소진되지 않음', PR.actions.isSoldOut(rMany()) === false);
ok('포인트 누적 차감', S().points === 800);

const t1 = S().purchases.find(p => p.rewardId === 'many1');
PR.actions.useTicket(t1.id);
ok('사용하면 used=true', S().purchases.find(p => p.id === t1.id).used === true);
ok('사용해도 포인트는 그대로', S().points === 800);
ok('미사용 티켓 2장 남음', S().purchases.filter(p => !p.used).length === 2);

PR.actions.unuseTicket(t1.id);
ok('사용 되돌리기', S().purchases.find(p => p.id === t1.id).used === false);

const onceTicket = S().purchases.find(p => p.rewardId === 'once1');
PR.actions.refundTicket(onceTicket.id);
ok('환불하면 포인트 반환', S().points === 900);
ok('환불하면 티켓 사라짐', !S().purchases.some(p => p.id === onceTicket.id));
ok('환불한 1회성은 다시 살 수 있음', PR.actions.isSoldOut(rOnce()) === false);

const usedT = S().purchases[0];
PR.actions.useTicket(usedT.id);
const ptsBefore = S().points;
PR.actions.refundTicket(usedT.id);
ok('이미 쓴 티켓은 환불 불가', S().points === ptsBefore && S().purchases.some(p => p.id === usedT.id));

console.log('\n[7] 하루 시작 시각 (자정 넘김)');
/* 시각을 갈아끼우기 위해 Date를 감싼다 — 컨텍스트의 Date만 바꾸면 모듈들이 그걸 쓴다 */
const RealDate = Date;
function atClock(h, m) {
  const base = new RealDate();
  base.setHours(h, m || 0, 0, 0);
  class FakeDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [base.getTime()])); }
    static now() { return base.getTime(); }
  }
  ctx.Date = FakeDate;
}
function realClock() { ctx.Date = RealDate; }

PR.store.state = PR.store.normalize({
  v: 6, points: 0, earned: 0, bestStreak: 0, freezes: 1, freezeMark: 0, frozenDates: [], lastReconcile: today,
  penaltyOn: true, dayStart: 4, plans: [], logs: [], projects: [], rewards: [], purchases: []
});
ok('기본 하루 시작 4시', PR.dayStart() === 4);

const calendarToday = PR.todayStr(new RealDate());
atClock(2, 30);
ok('새벽 2시 30분은 아직 어제', PR.todayStr() !== calendarToday);
ok('유예 시간대로 인식', PR.inGraceHours() === true);
ok('todayDate도 어제를 가리킴', PR.todayStr(PR.todayDate()) === PR.todayStr());

atClock(10, 0);
ok('아침 10시는 오늘', PR.todayStr() === calendarToday);
ok('유예 시간대 아님', PR.inGraceHours() === false);

atClock(2, 30);
PR.store.state.dayStart = 0;
ok('자정 기준이면 새벽도 오늘', PR.todayStr() === calendarToday);
PR.store.state.dayStart = 4;

/* 새벽에 스트릭이 어긋나지 않는지 — 루프 시작점이 new Date()면 여기서 0이 된다 */
atClock(1, 0);
const logical = PR.todayStr();
PR.store.state.plans = [{ id: 'n1', title: '야간', kind: 'routine', duty: false, basePts: 30, active: true,
  freq: { type: 'days', days: [] }, startDate: logical, endDate: '' }];
PR.store.state.logs = [{ id: 'nl1', planId: 'n1', date: logical, full: true, duty: false }];
ok('새벽에 완료해도 스트릭 1일로 잡힘', PR.points.computeStreak(false) === 1);
ok('소급(retro) 아님 → 보너스 유지', PR.points.calcAward(
  { kind: 'routine', basePts: 30, duty: false }, {}).retro === false);
realClock();

console.log('\n[8] 소급 완료 시 방어막·차감 되돌리기');
const missedDay = daysAgo(2);
PR.store.state = PR.store.normalize({
  v: 6, points: 100, earned: 100, bestStreak: 0, freezes: 0, freezeMark: 0,
  frozenDates: [daysAgo(3)], lastReconcile: today, penaltyOn: true, dayStart: 4,
  plans: [{ id: 'pd', title: '독서', kind: 'routine', duty: false, basePts: 30, active: true,
            freq: { type: 'days', days: [] }, startDate: daysAgo(10), endDate: '' }],
  logs: [{ id: 'pen1', planId: 'penalty', date: today, pts: -14, penalty: true, duty: true, full: false,
           days: [{ ds: missedDay, pen: 6 }, { ds: daysAgo(4), pen: 8 }] }],
  projects: [], rewards: [], purchases: []
});
PR.actions.completePlan('pd', { date: missedDay });
ok('차감분만 정확히 환급 (6P)', PR.store.state.logs.find(l => l.penalty).pts === -8);
ok('남은 차감 날짜는 유지', PR.store.state.logs.find(l => l.penalty).days.length === 1);
const gained = PR.store.state.logs.find(l => l.planId === 'pd').pts;
ok('포인트 = 기존 + 지급 + 환급', PR.store.state.points === 100 + gained + 6);
ok('소급 완료는 스트릭 보너스 없음', gained === 30);

/* 방어막으로 보호됐던 날을 소급 완료 */
PR.actions.completePlan('pd', { date: daysAgo(3) });
ok('방어막 보호일 해제', PR.store.state.frozenDates.indexOf(daysAgo(3)) === -1);
ok('방어막 1개 반환', PR.store.state.freezes === 1);

/* 남은 차감이 전부 환급되면 정산 로그 자체가 사라짐 */
PR.actions.completePlan('pd', { date: daysAgo(4) });
ok('전액 환급 시 정산 로그 제거', !PR.store.state.logs.some(l => l.penalty));

console.log('\n[9] 소급 완료 방어 규칙');
const before9 = PR.store.state.points;
PR.actions.completePlan('pd', { date: missedDay });
ok('같은 날 중복 완료 차단', PR.store.state.points === before9);
const future = PR.points.calcAward({ kind: 'routine', basePts: 30, duty: false }, { date: '2099-01-01' });
ok('미래 날짜는 오늘로 고정', future.doneDate === PR.todayStr());

console.log('\n' + (fail ? '실패 ' + fail + '건 / ' : '') + '통과 ' + pass + '건');
process.exit(fail ? 1 : 0);
