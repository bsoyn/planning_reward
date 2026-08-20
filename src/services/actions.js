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
    if (a.retro) parts.push('🕓 ' + a.doneDate + ' 완료로 기록 · 보너스 제외');
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

  /* 지난 날을 소급 완료해서 그 날이 '달성'이 되면, 그 날 때문에 치른 대가를 되돌린다.
     - 방어막으로 보호됐던 날 → 보호 해제 + 방어막 1개 반환
     - 차감됐던 날 → 그 날 몫만큼 포인트 환급 (정산 로그의 days에서 찾음)
     되돌릴 게 있으면 안내 문구를 반환. */
  function restoreForDate(ds) {
    var S = PR.store.state;
    var parts = [];

    var fi = (S.frozenDates || []).indexOf(ds);
    if (fi !== -1) {
      S.frozenDates.splice(fi, 1);
      if (S.freezes < FREEZE_CAP) S.freezes++;
      parts.push('🛡 방어막 1개 돌려받음');
    }

    var back = 0;
    S.logs = S.logs.filter(function (l) {
      if (!l.penalty || !l.days || !l.days.length) return true;
      var hit = 0;
      var keep = [];
      l.days.forEach(function (x) { if (x.ds === ds) hit += x.pen; else keep.push(x); });
      if (!hit) return true;
      back += hit;
      l.days = keep;
      l.pts += hit;        // pts는 음수 — 차감액이 줄어든다
      return l.pts < 0;    // 전액 환급되면 정산 로그 자체를 없앰
    });
    if (back) {
      S.points += back;
      parts.push('🥶 차감했던 ' + back + 'P 돌려받음');
    }

    return parts.length ? '<br><span style="opacity:.75">' + parts.join(' · ') + '</span>' : '';
  }

  var A = {};

  /* ---- 계획 완료/취소. input = {t:실제 분, q:실제 분량} ---- */
  A.completePlan = function (id, input) {
    var S = PR.store.state;
    var p = S.plans.find(function (x) { return x.id === id; });
    if (!p) return;
    var guardDate = (input && input.date) ? input.date : PR.todayStr();
    if (S.logs.some(function (l) { return l.planId === id && l.date === guardDate; })) return; // 같은 날 중복 방지
    if (p.kind === 'deadline' && p.done) return; // 소급 완료 등 중복 방지
    var a = PR.points.calcAward(p, input);
    var sp = (a.full && !a.retro) ? PR.points.rollSurprise(p.basePts) : { hit: false, pts: 0 };
    var total = a.total + sp.pts;
    S.logs.push({ id: PR.uid(), planId: id, date: a.doneDate, pts: total, r: a.r, full: a.full, duty: !!p.duty, onTime: a.onTime, surprise: sp.pts, retro: a.retro, ts: Date.now() });
    S.points += total;
    S.earned += total;
    var extraMsg = '';
    if (a.full && !p.duty && !a.retro) {
      S.bestStreak = Math.max(S.bestStreak, a.streak);
      extraMsg = grantFreezes(a.streak);
    }
    /* 소급 완료로 그 날이 달성이 됐다면 그때 쓴 방어막·차감 포인트를 되돌린다 */
    if (a.full && !p.duty && a.retro) extraMsg = restoreForDate(a.doneDate);
    if (p.kind === 'deadline') p.done = true;
    commit();
    awardToast(a, sp.pts, extraMsg);
  };

  A.uncompletePlan = function (id, date) {
    var S = PR.store.state;
    var l = date
      ? S.logs.find(function (x) { return x.planId === id && x.date === date; })
      : PR.sched.todayLog(id);
    if (!l) { // 소급 기록된 마감형: 마지막 로그로 취소
      var p0 = S.plans.find(function (x) { return x.id === id; });
      if (p0 && p0.kind === 'deadline' && p0.done) {
        var ls = S.logs.filter(function (x) { return x.planId === id; });
        l = ls[ls.length - 1];
      }
    }
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

  /* ---- 보상 & 사용권(티켓) ----
     구매 = 티켓 발급, 사용 = 티켓 소진. 다회성 보상은 티켓이 여러 장 쌓이고,
     1회성은 티켓이 남아 있는 동안 상점에서 잠긴다. */

  /* 1회성 보상이 이미 소진됐는지 — 플래그가 아니라 티켓 유무에서 파생 */
  A.isSoldOut = function (r) {
    if (!r || !r.once) return false;
    return PR.store.state.purchases.some(function (x) { return x.rewardId === r.id; });
  };

  A.addReward = function (name, cost, once) {
    PR.store.state.rewards.push({ id: PR.uid(), name: name, cost: cost, once: !!once });
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
    if (!r || S.points < r.cost || A.isSoldOut(r)) return;
    S.points -= r.cost;
    S.purchases.push({ id: PR.uid(), rewardId: r.id, name: r.name, cost: r.cost,
                       date: PR.todayStr(), used: false, usedAt: '' });
    commit();
    PR.toast('🎟 "' + PR.esc(r.name) + '" 사용권을 받았어요!' +
      '<br><span style="opacity:.75">쓰고 싶을 때 상점에서 사용하세요</span>');
  };

  /* 티켓 사용 (실제로 누릴 때) */
  A.useTicket = function (id) {
    var t = PR.store.state.purchases.find(function (x) { return x.id === id; });
    if (!t || t.used) return;
    t.used = true;
    t.usedAt = PR.todayStr();
    commit();
    PR.toast('🎉 "' + PR.esc(t.name) + '" 사용! 마음껏 즐기세요');
  };

  /* 잘못 눌러 사용 처리된 티켓 되돌리기 */
  A.unuseTicket = function (id) {
    var t = PR.store.state.purchases.find(function (x) { return x.id === id; });
    if (!t || !t.used) return;
    t.used = false;
    t.usedAt = '';
    commit();
  };

  /* 아직 안 쓴 티켓 환불 — 포인트를 돌려주고 티켓을 없앤다.
     1회성 보상은 티켓이 사라지면 자동으로 다시 살 수 있게 된다(파생 계산이므로). */
  A.refundTicket = function (id) {
    var S = PR.store.state;
    var t = S.purchases.find(function (x) { return x.id === id; });
    if (!t || t.used) return;
    S.points += t.cost;
    S.purchases = S.purchases.filter(function (x) { return x.id !== id; });
    commit();
    PR.toast('↩️ 구매 취소 · +' + t.cost + 'P 돌려받음');
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
  /* 하루 시작 시각 (0~6시). 자정 직후 완료가 '어제'로 기록되게 하는 유예 시간 */
  A.setDayStart = function (h) {
    var v = Math.max(0, Math.min(6, Number(h) || 0));
    PR.store.state.dayStart = v;
    commit();
    PR.toast(v === 0
      ? '하루 경계를 자정으로 맞췄어요'
      : '새벽 ' + v + '시까지는 어제로 기록돼요 🌙');
  };

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
