/* 상태 저장소: localStorage 영속화. 모든 상태 변경은 actions를 통해서만.

   데이터 모델 v4
   plan = { id, title, kind:'habit'|'routine'|'deadline', basePts, duty,
            targetT(분|null), targetQ(수|null), unitQ, mode:'or'|'and',   // routine/deadline
            time:'HH:MM'|'',                                             // routine
            freq:{type:'days',days:[]}|{type:'weekly',n},                // habit/routine
            deadline:'YYYY-MM-DD', createdAt,                            // deadline
            done, active }
   - habit(습관): 정해진 시각 없이 주기적으로 하면 좋은 것. 단순 O/X.
   - routine(반복적인 일): 목표(T/Q)·정시가 있는 반복 작업. 알바/출근 등 의무 포함.
   - duty(의무): 낮은 P 권장, 전체 스트릭 카운트에서 제외.
   log  = { id, planId, date, pts, r, full, duty, onTime, surprise, ts }  // 마일스톤 planId='ms:...', 페널티 planId='penalty'
   project = { id, title, bonusPts, deadline, createdAt, done, doneDate,
               milestones:[{id,title,pts,done,date}] }
   v4 심리 보강 필드: freezes(방어막), freezeMark(방어막 지급 눈금), frozenDates(방어막 보호일),
                     lastReconcile(마지막 정산일), penaltyOn(놓친 날 차감 여부) */
(function (PR) {
  'use strict';

  var LS_KEY = 'planning_reward_v1'; // 키는 유지 (내용의 v 필드로 버전 관리)
  var VER = 4;

  function blank() {
    return { v: VER, points: 0, earned: 0, plans: [], logs: [], projects: [], rewards: [], purchases: [], bestStreak: 0, lastMod: 0,
      /* v4: 심리 보강 */
      freezes: 1,            // 보유 방어막 수 (스트릭 보호)
      freezeMark: 0,         // 방어막을 지급한 최고 스트릭 눈금 (7일마다 +1)
      frozenDates: [],       // 방어막으로 보호된 날짜 (스트릭 유지에 성공으로 인정)
      lastReconcile: '',     // 마지막 일일 정산 날짜 (놓친 날 처리 기준)
      penaltyOn: true };     // 목표 놓친 날 소액 차감 여부
  }

  /* v1 → v2: 기본P = (수동P 또는 자동P) × 난이도 배율을 흡수 */
  function migrateV1(d) {
    d.plans = (d.plans || []).map(function (p) {
      var auto = p.type === 'timer' ? p.target : p.type === 'count' ? p.target : 20;
      var base = (p.pts != null && p.pts !== '') ? Number(p.pts) : auto;
      base = Math.round(base * ([1, 1, 1.5, 2][p.diff] || 1));
      return {
        id: p.id, title: p.title, kind: 'habit', basePts: base,
        targetT: p.type === 'timer' ? p.target : null,
        targetQ: p.type === 'count' ? p.target : null,
        unitQ: p.unit || '', mode: 'or', time: p.time || '',
        freq: { type: 'days', days: p.days || [] },
        deadline: '', createdAt: '', done: false, active: p.active !== false
      };
    });
    d.logs = (d.logs || []).map(function (l) { return Object.assign({ r: 1, full: true }, l); });
    d.projects = [];
    d.v = 2;
    return d;
  }

  /* v2 → v3: 기존 habit(목표·정시 가능)은 routine으로, duty 필드 추가 */
  function migrateV2(d) {
    d.plans = (d.plans || []).map(function (p) {
      return Object.assign({ duty: false }, p, { kind: p.kind === 'habit' ? 'routine' : p.kind });
    });
    d.logs = (d.logs || []).map(function (l) { return Object.assign({ duty: false }, l); });
    d.v = 3;
    return d;
  }

  /* v3 → v4: 방어막/정산 필드 추가. lastReconcile을 오늘로 두어 과거 소급 페널티 방지 */
  function migrateV3(d) {
    d.freezes = 1;
    d.freezeMark = 0;
    d.frozenDates = [];
    d.lastReconcile = PR.todayStr();
    d.penaltyOn = true;
    d.v = 4;
    return d;
  }

  function normalize(d) {
    if (!d || !d.v) return blank();
    if (d.v === 1) d = migrateV1(d);
    if (d.v === 2) d = migrateV2(d);
    if (d.v === 3) d = migrateV3(d);
    if (d.v !== VER) return blank();
    return Object.assign(blank(), d);
  }

  function load() {
    try { return normalize(JSON.parse(localStorage.getItem(LS_KEY))); } catch (e) {}
    return blank();
  }

  PR.store = {
    LS_KEY: LS_KEY,
    blank: blank,
    normalize: normalize,
    state: load(),

    /* 변경 저장 + 파일 동기화 트리거('saved' 이벤트) */
    save: function () {
      this.state.lastMod = Date.now();
      localStorage.setItem(LS_KEY, JSON.stringify(this.state));
      PR.bus.emit('saved');
    },

    /* 전체 교체 (가져오기/초기화) — 구버전 데이터도 자동 변환 */
    replace: function (next) {
      this.state = normalize(next);
      this.save();
    },

    /* 파일 복원용: lastMod를 갱신하지 않고 조용히 교체 */
    setRaw: function (next) {
      this.state = normalize(next);
      localStorage.setItem(LS_KEY, JSON.stringify(this.state));
    }
  };
})(window.PR = window.PR || {});
