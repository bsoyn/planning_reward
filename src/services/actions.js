/* 액션: 상태를 변경하는 유일한 창구. 변경 후 save + 'change' 이벤트 발행 */
(function (PR) {
  'use strict';

  function commit() {
    PR.store.save();
    PR.bus.emit('change');
  }

  function awardToast(a, surprisePts, extra) {
    var total = a.total + (surprisePts || 0);
    var msg = (a.full ? '✅' : '🔸') + ' +' + total + 'P' + (a.full ? ' 획득!' : ' (부분 달성 ' + Math.round(Math.min(a.r, 1) * 100) + '%)');
    var parts = [];
    if (a.full && a.sb > 0) parts.push('스트릭 ' + a.streak + '일 +' + Math.round(a.sb * 100) + '%');
    if (a.onTime) parts.push('⏰ 정시 +' + a.otPts + 'P');
    if (a.over > 0) parts.push('💪 초과 +' + a.over + 'P');
    if (a.early > 0) parts.push('🚀 조기 +' + a.early + 'P');
    if (surprisePts) parts.push('🎉 서프라이즈 +' + surprisePts + 'P!');
    if (a.late) parts.push('⏳ 마감 지남 -50%');
    if (parts.length) msg += '<br><span style="opacity:.75">' + parts.join(' · ') + '</span>';
    if (extra) msg += extra;
    PR.toast(msg);
  }

  /* 스트릭 7일 눈금마다 방어막 +1 (상한 3). 방어막 지급 시 문구 반환 */
  var FREEZE_CAP = 3;
  function grantFreezes(streak) {
    var S = PR.store.state;
    var got = 0;
    while (S.freezeMark + 7 <= streak) {
      S.freezeMark += 7;
      if (S.freezes < FREEZE_CAP) { S.freezes++; got++; }
    }
    return got ? '<br><span style="opacity:.75">🛡 방어막 +' + got + ' (연속 ' + S.freezeMark + '일 달성)</span>' : '';
  }

  var A = {};

  /* ---- 계획 완료/취소. input = {t:실제 분, q:실제 분량} ---- */
  A.completePlan = function (id, input) {
    var S = PR.store.state;
    var p = S.plans.find(function (x) { return x.id === id; });
    if (!p || PR.sched.todayLog(id)) return;
    var a = PR.points.calcAward(p, input);
    var sp = a.full ? PR.points.rollSurprise(p.basePts) : { hit: false, pts: 0 };
    var total = a.total + sp.pts;
    S.logs.push({ id: PR.uid(), planId: id, date: PR.todayStr(), pts: total, r: a.r, full: a.full, duty: !!p.duty, onTime: a.onTime, surprise: sp.pts, ts: Date.now() });
    S.points += total;
    S.earned += total;
    var freezeMsg = '';
    if (a.full && !p.duty) {
      S.bestStreak = Math.max(S.bestStreak, a.streak);
      freezeMsg = grantFreezes(a.streak);
    }
    if (p.kind === 'deadline') p.done = true;
    commit();
    awardToast(a, sp.pts, freezeMsg);
  };

  A.uncompletePlan = function (id) {
    var S = PR.store.state;
    var l = PR.sched.todayLog(id);
    if (!l) return;
    S.points -= l.pts;
    S.earned -= l.pts;
    S.logs = S.logs.filter(function (x) { return x.id !== l.id; });
    var p = S.plans.find(function (x) { return x.id === id; });
    if (p && p.kind === 'deadline') p.done = false;
    commit();
  };

  /* ---- 계획 CRUD ---- */
  A.savePlan = function (p, isEdit) {
    var S = PR.store.state;
    if (isEdit) {
      S.plans = S.plans.map(function (x) { return x.id === p.id ? p : x; });
    } else {
      S.plans.push(p);
    }
    commit();
    PR.toast(PR.esc(p.title) + ' 저장 완료 ✓');
  };

  A.deletePlan = function (id) {
    var S = PR.store.state;
    S.plans = S.plans.filter(function (p) { return p.id !== id; });
    commit();
  };

  /* ---- 프로젝트 ---- */
  A.saveProject = function (pj) {
    PR.store.state.projects.push(pj);
    commit();
    PR.toast(PR.esc(pj.title) + ' 프로젝트 시작 🚩');
  };

  A.deleteProject = function (id) {
    var S = PR.store.state;
    S.projects = S.projects.filter(function (p) { return p.id !== id; });
    commit();
  };

  A.completeMilestone = function (pjId, msId) {
    var S = PR.store.state;
    var pj = S.projects.find(function (x) { return x.id === pjId; });
    if (!pj || pj.done) return;
    var ms = pj.milestones.find(function (m) { return m.id === msId; });
    if (!ms || ms.done) return;
    ms.done = true;
    ms.date = PR.todayStr();
    var sp = PR.points.rollSurprise(ms.pts);
    var msTotal = ms.pts + sp.pts;
    S.logs.push({ id: PR.uid(), planId: 'ms:' + msId, date: ms.date, pts: msTotal, r: 1, full: true, duty: false, onTime: false, surprise: sp.pts, ts: Date.now() });
    S.points += msTotal;
    S.earned += msTotal;
    var st = PR.points.computeStreak(true);
    S.bestStreak = Math.max(S.bestStreak, st);
    var freezeMsg = grantFreezes(st);
    var allDone = pj.milestones.every(function (m) { return m.done; });
    var msg = '✅ +' + msTotal + 'P — ' + PR.esc(ms.title) +
      (sp.pts ? ' <span style="opacity:.75">🎉 서프라이즈 +' + sp.pts + 'P!</span>' : '') + freezeMsg;
    if (allDone) {
      var b = PR.points.projectBonus(pj);
      pj.done = true;
      pj.doneDate = PR.todayStr();
      S.logs.push({ id: PR.uid(), planId: 'pj:' + pj.id, date: pj.doneDate, pts: b.total, r: 1, full: true, duty: false, onTime: false, ts: Date.now() });
      S.points += b.total;
      S.earned += b.total;
      msg = '🏆 프로젝트 완주! 보너스 +' + b.total + 'P' +
        (b.early ? '<br><span style="opacity:.75">🚀 조기 완주 +' + b.early + 'P 포함</span>' : '') +
        (b.late ? '<br><span style="opacity:.75">⏳ 마감 지남 -50%</span>' : '');
    }
    commit();
    PR.toast(msg);
  };

  A.uncompleteMilestone = function (pjId, msId) {
    var S = PR.store.state;
    var pj = S.projects.find(function (x) { return x.id === pjId; });
    if (!pj || pj.done) return; // 완주 후엔 되돌리기 불가
    var ms = pj.milestones.find(function (m) { return m.id === msId; });
    if (!ms || !ms.done) return;
    ms.done = false;
    ms.date = '';
    var l = S.logs.find(function (x) { return x.planId === 'ms:' + msId; });
    if (l) {
      S.points -= l.pts;
      S.earned -= l.pts;
      S.logs = S.logs.filter(function (x) { return x.id !== l.id; });
    }
    commit();
  };

  /* ---- 보상 ---- */
  A.addReward = function (name, cost) {
    PR.store.state.rewards.push({ id: PR.uid(), name: name, cost: cost });
    commit();
  };

  A.deleteReward = function (id) {
    var S = PR.store.state;
    S.rewards = S.rewards.filter(function (r) { return r.id !== id; });
    commit();
  };

  A.buyReward = function (id) {
    var S = PR.store.state;
    var r = S.rewards.find(function (x) { return x.id === id; });
    if (!r || S.points < r.cost) return;
    S.points -= r.cost;
    S.purchases.push({ id: PR.uid(), name: r.name, cost: r.cost, date: PR.todayStr() });
    commit();
    PR.toast('🎉 "' + PR.esc(r.name) + '" 구매! 마음껏 즐기세요');
  };

  /* ---- 번외 기록: 계획에 없던 일. 가치의 80% 지급, 보너스·스트릭 없음 ---- */
  A.addAdhoc = function (title, worth) {
    var S = PR.store.state;
    var pts = Math.max(1, Math.round(worth * 0.8));
    S.logs.push({ id: PR.uid(), planId: 'adhoc', title: title, date: PR.todayStr(), pts: pts, r: 1, full: true, duty: false, adhoc: true, onTime: false, ts: Date.now() });
    S.points += pts;
    S.earned += pts;
    commit();
    PR.toast('🔖 번외 +' + pts + 'P <span style="opacity:.75">(가치 ' + worth + 'P의 80%)</span>');
  };

  A.deleteAdhoc = function (logId) {
    var S = PR.store.state;
    var l = S.logs.find(function (x) { return x.id === logId && x.adhoc; });
    if (!l) return;
    S.points -= l.pts;
    S.earned -= l.pts;
    S.logs = S.logs.filter(function (x) { return x.id !== logId; });
    commit();
  };

  /* ---- 설정 ---- */
  A.setPenalty = function (on) {
    PR.store.state.penaltyOn = !!on;
    commit();
    PR.toast(on ? '놓친 날 소액 차감 켜짐' : '놓친 날 차감 꺼짐');
  };

  /* ---- 데이터 ---- */
  A.resetAll = function () {
    PR.store.replace(PR.store.blank());
    PR.bus.emit('change');
  };

  A.importState = function (d) {
    PR.store.replace(d);
    PR.bus.emit('change');
    PR.toast('가져오기 완료 ✓');
  };

  PR.actions = A;
})(window.PR = window.PR || {});
