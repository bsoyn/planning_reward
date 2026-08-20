/* 일일 정산 — 앱 로드 시 1회. 지난 "놓친 예정일"을 처리한다.
   놓친 날(예정 있었는데 완전 달성 없음, 방어막 미보호):
     - 방어막이 있으면 자동 소모 → 그 날을 frozenDates에 넣어 스트릭 보호 (페널티 없음)
     - 없고 penaltyOn이면 소액 차감 (총액 상한)
   과거 소급 방지: lastReconcile 이후 ~ 어제까지만. 오늘은 아직 안 끝났으니 건드리지 않음.
   포인트는 0 밑으로 내려가지 않음. 처리 요약은 반환(로드 후 토스트). */
(function (PR) {
  'use strict';

  var PENALTY_RATE = 0.2;   // 놓친 계획 기본P의 20%
  var PENALTY_CAP = 30;     // 1회 정산 총 차감 상한

  function run() {
    var S = PR.store.state;
    var today = PR.todayStr();
    if (S.lastReconcile === today) return null;
    if (!S.lastReconcile) { S.lastReconcile = today; PR.store.save(); return null; } // 첫 실행: 기준일만 설정

    var frozen = {};
    (S.frozenDates || []).forEach(function (d) { frozen[d] = 1; });

    /* lastReconcile 다음날 ~ 어제까지의 놓친 예정일 수집 */
    var missed = [];
    var d = new Date(S.lastReconcile + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    var guard = 0;
    while (PR.todayStr(d) < today && guard++ < 400) {
      var ds = PR.todayStr(d);
      if (!frozen[ds] && !PR.points.metOn(ds) && PR.points.obligationOn(ds)) {
        /* 그 날 예정됐던 비의무 계획들의 기본P 평균 */
        var due = S.plans.filter(function (p) {
          return !p.duty && (p.kind === 'habit' || p.kind === 'routine') &&
            (!p.freq || p.freq.type !== 'weekly') && PR.sched.isScheduledOn(p, ds);
        });
        var avg = due.reduce(function (a, p) { return a + (p.basePts || 0); }, 0) / (due.length || 1);
        missed.push({ ds: ds, pen: Math.max(1, Math.round(avg * PENALTY_RATE)) });
      }
      d.setDate(d.getDate() + 1);
    }

    /* 어느 날짜에서 얼마를 깎았는지 days에 남긴다 — 그 날을 나중에 소급 완료하면
       정확히 그만큼만 되돌려주기 위해서. 총액만 남기면 환급액을 알 수 없다. */
    var saved = 0, penalty = 0;
    var applied = [];
    missed.forEach(function (m) {
      if (S.freezes > 0) {                 // 방어막으로 보호
        S.freezes--;
        S.frozenDates.push(m.ds);
        saved++;
      } else if (S.penaltyOn) {            // 소액 차감 (상한까지만)
        var room = PENALTY_CAP - penalty;
        if (room <= 0) return;
        var pen = Math.min(m.pen, room);
        penalty += pen;
        applied.push({ ds: m.ds, pen: pen });
      }
    });

    /* 포인트가 모자라 다 못 깎으면, 실제로 깎은 날만 기록에 남긴다 */
    if (penalty > S.points) {
      var acc = 0;
      applied = applied.filter(function (a) {
        if (acc + a.pen > S.points) return false;
        acc += a.pen;
        return true;
      });
      penalty = acc;
    }
    var penDays = applied.length;

    if (penalty > 0) {
      S.points = Math.max(0, S.points - penalty);
      S.logs.push({ id: PR.uid(), planId: 'penalty', date: today, pts: -penalty,
        r: 0, full: false, duty: true, onTime: false, penalty: true, days: applied, ts: Date.now() });
    }

    S.lastReconcile = today;
    PR.store.save();

    if (!saved && !penalty) return null;
    var parts = [];
    if (saved) parts.push('🛡 방어막 ' + saved + '개로 스트릭 지킴');
    if (penalty) parts.push('🥶 놓친 날 ' + penDays + '일 · -' + penalty + 'P');
    return parts.join('<br>');
  }

  PR.reconcile = { run: run };
})(window.PR = window.PR || {});
