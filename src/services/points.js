/* 포인트/스트릭 계산 — 순수 로직 (DOM 의존 없음)

   수식 (1P ≈ 100원 노고 가치, 기본P는 사용자가 직접 설정)
   r  = 달성률: 목표 없으면 1, T만/Q만 있으면 해당 비율,
        둘 다 있으면 OR=max / AND=min
   지급       = 기본P × eff × (1 + 스트릭보너스 if 완전달성)
                eff = 완전달성 1 / 부분 max(r^1.5, 최소 0.1)  ← 부분 완화 + 착수 최저보상
   스트릭보너스 = min(연속일 × 2%, 50%)          — r ≥ 1일 때만
   정시보너스  = 기본P × 30% — 시간대(시작~끝) 안에 완료, 끝 미지정 시 시작 ±30분. r ≥ 1일 때만
   초과보너스  = 기본P × 50% × min(r-1, 1)       — 초과분 절반 요율, 상한 +50%
   조기보너스  = 기본P × 30% × 남은기간비율        — 1회성, r ≥ 1, 목표일 전
   늦음       = 목표일 지나면 총액 × 80% (-20%)   — '마감'이 아니라 '목표일'이라 가볍게
   서프라이즈  = 완전달성 시 낮은 확률로 추가 지급 (변동비율 강화, 액션에서만 굴림)
   번외 기록   = 가치의 80%, 보너스·스트릭 없음 (계획한 일이 항상 더 값지게)
   스트릭: 스케줄 인식(예정일만 의무) + 방어막 반영, 비의무·비번외 완전 달성만 인정 */
(function (PR) {
  'use strict';

  var FULL = 1 - 1e-9;

  /* 목표일을 넘겨 끝냈을 때 남는 지급 비율. '마감'이 아니라 '목표일'이라는 이름에 맞춰
     벌이 아니라 살짝 아쉬운 정도로 (-20%). UI 문구도 이 값에서 만들어 쓴다. */
  var LATE_RATE = 0.8;
  function latePct() { return Math.round((1 - LATE_RATE) * 100); }   // 20
  function lateKeepPct() { return Math.round(LATE_RATE * 100); }     // 80

  /* 달성률. input = {t:실제 분, q:실제 분량} */
  function ratio(p, input) {
    input = input || {};
    var rT = p.targetT ? (Number(input.t) || 0) / p.targetT : null;
    var rQ = p.targetQ ? (Number(input.q) || 0) / p.targetQ : null;
    if (rT != null && rQ != null) return p.mode === 'and' ? Math.min(rT, rQ) : Math.max(rT, rQ);
    if (rT != null) return rT;
    if (rQ != null) return rQ;
    return 1; // O/X형
  }

  /* 그 날 완전 달성(비의무·비번외) 기록이 있는지 */
  function metOn(ds) {
    return PR.store.state.logs.some(function (l) {
      return l.date === ds && l.full && !l.duty && !l.adhoc;
    });
  }

  /* 그 날 "해야 할 일"이 있었는지 — 요일 고정 습관/반복(비의무)만 의무로 침.
     주 n회형은 특정일 의무가 아니므로 제외. */
  function obligationOn(ds) {
    return PR.store.state.plans.some(function (p) {
      return !p.duty && (p.kind === 'habit' || p.kind === 'routine') &&
        (!p.freq || p.freq.type !== 'weekly') && PR.sched && PR.sched.isScheduledOn(p, ds);
    });
  }

  /* 거슬러 올라갈 하한 — 반복 계획 시작일·기록·방어막 보호일 중 가장 이른 날.
     그보다 이전은 인정될 수도, 끊길 수도 없으므로 결과를 바꾸지 않고 순회만 아낀다. */
  function streakFloor() {
    var S = PR.store.state;
    var floor = null;
    function lo(ds) { if (ds && (!floor || ds < floor)) floor = ds; }
    S.plans.forEach(function (p) {
      if (p.kind === 'habit' || p.kind === 'routine') lo(p.startDate);
    });
    S.logs.forEach(function (l) { lo(l.date); });
    (S.frozenDates || []).forEach(lo);
    return floor;
  }

  /* 연속 달성일 (스케줄 인식 + 방어막 반영).
     - 완전 달성했거나 방어막으로 보호된 날 → 인정, 카운트
     - 아무것도 안 했지만 예정도 없던 날(휴식일) → 중립(스트릭 유지, 카운트 안 함)
     - 예정이 있었는데 놓친 날 → 스트릭 끊김
     extraToday=true면 오늘은 완전 달성으로 간주 */
  function computeStreak(extraToday) {
    var frozen = {};
    (PR.store.state.frozenDates || []).forEach(function (d) { frozen[d] = 1; });
    var todayS = PR.todayStr();
    var floor = streakFloor();
    function met(ds) { return frozen[ds] || metOn(ds) || (extraToday && ds === todayS); }

    var cur = 0;
    var d = PR.todayDate();
    if (!met(todayS)) d.setDate(d.getDate() - 1); // 오늘 미완료 = 아직 안 끊김
    for (var i = 0; i < 3650; i++) {
      var ds = PR.todayStr(d);
      if (floor && ds < floor) break;
      if (met(ds)) { cur++; }
      else if (obligationOn(ds)) { break; } // 예정 있었는데 놓침 → 종료
      // else 휴식일: 중립, 계속 거슬러 올라감
      d.setDate(d.getDate() - 1);
    }
    return cur;
  }

  function streakBonus(s) { return Math.min(s * 0.02, 0.5); }

  /* 주어진 시각(분 단위)이 계획의 수행 시간대 안인지 */
  function inWindow(p, cur) {
    if (!p.time) return false;
    var hm = p.time.split(':').map(Number);
    var from = hm[0] * 60 + hm[1];
    if (p.timeTo) {
      var hm2 = p.timeTo.split(':').map(Number);
      var to = hm2[0] * 60 + hm2[1];
      return to >= from ? (cur >= from && cur <= to) : (cur >= from || cur <= to); // 자정 넘김 허용
    }
    return Math.abs(cur - from) <= 30;
  }

  /* 1회성 목표일 기준 조기/늦음 판정. {earlyRatio: 0~1, late: bool} */
  function deadlineState(p, todayStr) {
    if (!p.deadline) return { earlyRatio: 0, late: false };
    var today = todayStr || PR.todayStr();
    var total = Math.max(1, PR.daysBetween(p.createdAt || today, p.deadline));
    var left = PR.daysBetween(today, p.deadline);
    if (left < 0) return { earlyRatio: 0, late: true };
    return { earlyRatio: Math.min(left / total, 1), late: false };
  }

  /* 완료 시 지급 계산. now는 테스트 주입용.
     input.date(YYYY-MM-DD)가 오늘 이전이면 "소급 기록": 실제 완료일 기준으로
     지각 여부를 판정하되, 스트릭·정시·서프라이즈 보너스는 붙지 않는다. */
  function calcAward(p, input, now) {
    now = now || new Date();
    var doneDate = (input && input.date) ? input.date : PR.todayStr();
    if (doneDate > PR.todayStr()) doneDate = PR.todayStr(); // 미래 불가
    var retro = doneDate < PR.todayStr();
    var base = p.basePts;
    var r = ratio(p, input);
    var rc = Math.min(r, 1);
    var full = r >= FULL;

    /* 의무 항목은 스트릭에 기여하지 않으므로 현재 스트릭 기준으로만 보너스 적용 */
    var s = computeStreak(!p.duty);
    var sb = (full && !retro) ? streakBonus(s) : 0;
    /* 부분 달성 완화(r²→r^1.5) + 착수 최저보상: 조금이라도 하면 최소 10% 보장.
       "완벽 못 하면 시작도 안 함"을 줄임 (완전 달성은 그대로 100%). */
    var eff = full ? 1 : Math.max(Math.pow(rc, 1.5), rc > 0 ? 0.1 : 0);
    var main = Math.round(base * eff * (1 + sb));

    var onTime = false, otPts = 0;
    /* 정시 판정: 완료 폼의 체크(input.ontime)가 있으면 그 값을 신뢰,
       없으면 지금 시각으로 판정. 소급 기록은 체크한 경우에만 인정 */
    if (full && p.time) {
      var ok;
      if (input && input.ontime !== undefined) ok = !!input.ontime;
      else if (retro) ok = false;
      else ok = inWindow(p, now.getHours() * 60 + now.getMinutes());
      if (ok) { onTime = true; otPts = Math.round(base * 0.3); }
    }

    var over = r > 1 ? Math.round(base * 0.5 * Math.min(r - 1, 1)) : 0;

    var early = 0, late = false;
    if (p.kind === 'deadline') {
      var ds = deadlineState(p, doneDate); // 실제 완료일 기준 판정
      late = ds.late;
      if (full && !late) early = Math.round(base * 0.3 * ds.earlyRatio);
    }

    var total = main + otPts + over + early;
    if (late) total = Math.round(total * LATE_RATE);

    return { total: total, main: main, otPts: otPts, over: over, early: early,
             late: late, onTime: onTime, r: r, full: full, streak: s, sb: sb,
             retro: retro, doneDate: doneDate };
  }

  /* 서프라이즈 보너스: 완전 달성 시 낮은 확률로 추가 지급 (변동비율 강화).
     미리보기를 흔들지 않도록 계산에서 분리 — 완료 액션에서만 굴린다. */
  var SURPRISE_P = 0.13;
  function rollSurprise(base) {
    if (!base || Math.random() >= SURPRISE_P) return { hit: false, pts: 0 };
    var pts = Math.max(1, Math.round(base * (0.2 + Math.random() * 0.3))); // 20~50%
    return { hit: true, pts: pts };
  }

  /* 완주 보너스 (프로젝트). 목표일 있으면 조기 가산/늦음 감액 동일 규칙 */
  function projectBonus(pj) {
    var bonus = pj.bonusPts || 0;
    if (!pj.deadline) return { total: bonus, early: 0, late: false };
    var ds = deadlineState(pj);
    if (ds.late) return { total: Math.round(bonus * LATE_RATE), early: 0, late: true };
    var early = Math.round(bonus * 0.3 * ds.earlyRatio);
    return { total: bonus + early, early: early, late: false };
  }

  PR.points = {
    ratio: ratio,
    metOn: metOn,
    obligationOn: obligationOn,
    computeStreak: computeStreak,
    streakBonus: streakBonus,
    inWindow: inWindow,
    deadlineState: deadlineState,
    calcAward: calcAward,
    rollSurprise: rollSurprise,
    projectBonus: projectBonus,
    LATE_RATE: LATE_RATE,
    latePct: latePct,
    lateKeepPct: lateKeepPct
  };
})(window.PR = window.PR || {});
