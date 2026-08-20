/* 계획 스케줄 판정 — 순수 로직 */
(function (PR) {
  'use strict';

  /* 반복 기간(startDate~endDate) 안의 날짜인지. 비어 있으면 그쪽은 무제한 */
  function inRange(p, dateStr) {
    if (p.startDate && dateStr < p.startDate) return false;
    if (p.endDate && dateStr > p.endDate) return false;
    return true;
  }

  /* 반복 기간이 이미 끝난 계획인지 */
  function isExpired(p, dateStr) {
    return !!(p.endDate && (dateStr || PR.todayStr()) > p.endDate);
  }

  /* 반복 계획(습관/반복적인 일)이 해당 날짜에 예정인지 (요일 고정: 매칭 / 주 n회: 매일 노출).
     반복 기간 밖(추가하기 전 과거, 종료 후)은 예정 아님 — 스트릭·달성률·달력 모두 이 판정을 따른다. */
  function isScheduledOn(p, dateStr) {
    if (!p.active || (p.kind !== 'habit' && p.kind !== 'routine')) return false;
    if (!inRange(p, dateStr)) return false;
    var f = p.freq || { type: 'days', days: [] };
    if (f.type === 'weekly') return true;
    if (f.days && f.days.length) {
      var wd = new Date(dateStr + 'T12:00:00').getDay();
      return f.days.indexOf(wd) !== -1;
    }
    return true; // 요일 미선택 = 매일
  }

  /* 오늘 완료 기록 (계획당 하루 1회) */
  function todayLog(planId) {
    var today = PR.todayStr();
    return PR.store.state.logs.find(function (l) { return l.planId === planId && l.date === today; });
  }

  /* 이번 주 완전 달성 횟수 (주간 쿼터용, 월요일 시작) */
  function weekFullCount(planId, dateStr) {
    var wk = PR.weekKey(dateStr || PR.todayStr());
    return PR.store.state.logs.filter(function (l) {
      return l.planId === planId && l.full && PR.weekKey(l.date) === wk;
    }).length;
  }

  /* 미완료 마감형 계획 (마감 임박순) */
  function pendingDeadlines() {
    return PR.store.state.plans
      .filter(function (p) { return p.kind === 'deadline' && p.active && !p.done; })
      .sort(function (a, b) { return (a.deadline || '9999').localeCompare(b.deadline || '9999'); });
  }

  /* 계획별 개인 스트릭 (요일 고정: 연속 예정일 / 주 n회: 연속 충족 주) */
  function planStreak(p) {
    var f = p.freq || { type: 'days', days: [] };
    if (f.type === 'weekly') {
      var n = 0;
      var wk = PR.weekKey(PR.todayStr());
      if (weekFullCount(p.id, wk) >= f.n) n++;
      var d = new Date(wk + 'T12:00:00');
      var minWk = p.startDate ? PR.weekKey(p.startDate) : '';
      for (var i = 0; i < 520; i++) {
        d.setDate(d.getDate() - 7);
        if (minWk && PR.todayStr(d) < minWk) break; // 반복 기간 이전 = 더 볼 것 없음
        if (weekFullCount(p.id, PR.todayStr(d)) >= f.n) n++;
        else break;
      }
      return { n: n, unit: '주' };
    }
    var dates = {};
    PR.store.state.logs.forEach(function (l) { if (l.planId === p.id && l.full) dates[l.date] = 1; });
    var cur = 0;
    var day = PR.todayDate();
    var ds = PR.todayStr(day);
    if (isScheduledOn(p, ds) && !dates[ds]) day.setDate(day.getDate() - 1); // 오늘 미완료 = 아직 안 끊김
    for (var j = 0; j < 3650; j++) {
      ds = PR.todayStr(day);
      if (p.startDate && ds < p.startDate) break; // 반복 기간 이전 = 더 볼 것 없음
      if (isScheduledOn(p, ds)) {
        if (dates[ds]) cur++;
        else break;
      }
      day.setDate(day.getDate() - 1);
    }
    return { n: cur, unit: '일' };
  }

  PR.sched = {
    inRange: inRange,
    isExpired: isExpired,
    isScheduledOn: isScheduledOn,
    todayLog: todayLog,
    weekFullCount: weekFullCount,
    pendingDeadlines: pendingDeadlines,
    planStreak: planStreak
  };
})(window.PR = window.PR || {});
