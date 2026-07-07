/* 오늘 탭: 습관 + 1회성(마감) + 반복적인 일 + 프로젝트 다음 단계 */
(function (PR) {
  'use strict';

  var openId = null; // 완료 입력 폼이 열린 계획 id

  function expectFull(p) { // 완전 달성 시 예상 포인트 (미리보기)
    return PR.points.calcAward(p, { t: p.targetT || 0, q: p.targetQ || 0 }).total;
  }

  function planRow(p) {
    var done = !!PR.sched.todayLog(p.id);
    var hasTarget = p.targetT || p.targetQ;
    var quota = '';
    if (p.kind === 'routine' && p.freq && p.freq.type === 'weekly') {
      var k = PR.sched.weekFullCount(p.id);
      quota = '<span class="chip ' + (k >= p.freq.n ? 'd1' : '') + '">이번 주 ' + Math.min(k, p.freq.n) + '/' + p.freq.n + (k >= p.freq.n ? ' ✓' : '') + '</span>';
    }
    var hint = '';
    if (!done && p.kind === 'deadline') {
      var ds = PR.points.deadlineState(p);
      hint = '<div class="sub" style="margin-top:2px">' + (ds.late
        ? '<span style="color:var(--red)">마감 지남 · 지급 50%</span>'
        : '지금 끝내면 조기 보너스 +' + Math.round(p.basePts * 0.3 * ds.earlyRatio) + 'P') + '</div>';
    }
    var h = '<div class="plan ' + (done ? 'done' : '') + '">' +
      '<div class="grow">' +
        '<div class="t">' + PR.esc(p.title) + '</div>' +
        '<div style="margin-top:4px">' + PR.vh.planChips(p) + quota + '</div>' +
        (done ? '' : '<div class="sub" style="margin-top:4px">완전 달성 시 <span class="pts">+' + expectFull(p) + 'P</span>' +
          (p.time ? ' · ⏰정시 +' + Math.round(p.basePts * 0.3) + 'P' : '') + '</div>') + hint +
      '</div>' +
      (done
        ? '<button class="gray small" data-undo="' + p.id + '">취소</button>'
        : (hasTarget
            ? '<button class="' + (openId === p.id ? 'gray' : '') + '" data-open="' + p.id + '">' + (openId === p.id ? '닫기' : '완료') + '</button>'
            : '<button data-donex="' + p.id + '">완료</button>')) +
    '</div>';
    if (!done && hasTarget && openId === p.id) h += PR.vh.completeForm(p, 'c' + p.id);
    return h;
  }

  PR.app.register('today', {
    render: function () {
      var S = PR.store.state;
      var today = PR.todayStr();
      var now = new Date();
      var out = '<h2>' + (now.getMonth() + 1) + '월 ' + now.getDate() + '일 (' + PR.DAYS[now.getDay()] + ') 오늘</h2>';

      /* 1. 오늘의 습관 (단순 토글) */
      var habits = S.plans.filter(function (p) { return p.kind === 'habit' && PR.sched.isScheduledOn(p, today); });
      if (habits.length) {
        var hDone = habits.filter(function (p) { return PR.sched.todayLog(p.id); }).length;
        out += '<div class="card"><div class="sub" style="margin-bottom:4px">🌱 습관 · ' + hDone + '/' + habits.length + '</div>' +
          habits.map(function (p) {
            var done = !!PR.sched.todayLog(p.id);
            var st = PR.sched.planStreak(p);
            return '<div class="plan ' + (done ? 'done' : '') + '">' +
              '<div class="grow"><div class="t">' + PR.esc(p.title) + '</div>' +
              '<div class="sub">🔥' + st.n + st.unit + ' · +' + p.basePts + 'P</div></div>' +
              '<button class="' + (done ? 'gray ' : '') + 'small" data-hb="' + p.id + '">' + (done ? '✓ 완료' : '체크') + '</button>' +
            '</div>';
          }).join('') + '</div>';
      }

      /* 2. 1회성 (마감) — 반복보다 우선 노출 */
      var dls = PR.sched.pendingDeadlines();
      if (dls.length) {
        out += '<div class="card"><div class="sub" style="margin-bottom:4px">📅 1회성 (마감)</div>' +
          dls.map(planRow).join('') + '</div>';
      }

      /* 3. 반복적인 일 */
      var routines = S.plans.filter(function (p) { return p.kind === 'routine' && PR.sched.isScheduledOn(p, today); });
      if (routines.length) {
        var doneN = routines.filter(function (p) { return PR.sched.todayLog(p.id); }).length;
        out += '<div class="card"><div class="sub" style="margin-bottom:4px">🔁 반복적인 일 · 달성 ' + doneN + '/' + routines.length + '</div>' +
          routines.map(planRow).join('') + '</div>';
      }

      /* 4. 프로젝트 다음 단계 */
      var pjs = S.projects.filter(function (x) { return !x.done; });
      if (pjs.length) {
        out += '<div class="card"><div class="sub" style="margin-bottom:4px">🚩 프로젝트 — 다음 단계</div>' +
          pjs.map(function (pj) {
            var doneN = pj.milestones.filter(function (m) { return m.done; }).length;
            var next = pj.milestones.find(function (m) { return !m.done; });
            return '<div class="plan"><div class="grow">' +
              '<div class="t">' + PR.esc(pj.title) + '</div>' +
              PR.vh.progressBar(doneN, pj.milestones.length) +
              (next ? '<div class="sub" style="margin-top:4px">다음: <b>' + PR.esc(next.title) + '</b> <span class="pts">+' + next.pts + 'P</span></div>' : '') +
              (doneN === pj.milestones.length - 1 ? '<div class="sub">마지막 단계! 완주 보너스 +' + PR.points.projectBonus(pj).total + 'P</div>' : '') +
            '</div>' +
            (next ? '<button data-ms="' + pj.id + ':' + next.id + '">완료</button>' : '') +
            '</div>';
          }).join('') + '</div>';
      }

      if (!habits.length && !routines.length && !dls.length && !pjs.length) {
        out += '<div class="card"><div class="empty">오늘 예정된 계획이 없어요.<br>📋 계획 탭에서 추가해 보세요!</div></div>';
      }
      /* 5. 번외 기록: 계획에 없던 일 */
      var ads = S.logs.filter(function (l) { return l.adhoc && l.date === today; });
      out += '<div class="card">' +
        '<div style="font-weight:700">🔖 계획에 없던 일</div>' +
        '<div class="sub" style="margin-top:2px">즉흥적으로 한 일도 기록하고 포인트 받기 — 계획한 일의 80%로 지급, 연속 달성 일수에는 안 들어가요</div>' +
        '<div class="row" style="margin-top:8px">' +
          '<input id="ad-title" style="flex:2" placeholder="무엇을 했나요?">' +
          '<input id="ad-pts" type="number" min="1" placeholder="가치 P" style="width:80px">' +
          '<button id="ad-add">기록</button>' +
        '</div>' +
        (ads.length ? '<div style="margin-top:8px">' + ads.map(function (l) {
          return '<div class="hist"><span>🔖 ' + PR.esc(l.title || '') + ' <span class="pts">+' + l.pts + 'P</span></span>' +
            '<button class="danger small" data-addel="' + l.id + '">✕</button></div>';
        }).join('') + '</div>' : '') +
      '</div>';

      return out;
    },

    bind: function (root) {
      root.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.hb) { // 습관 토글
          if (PR.sched.todayLog(b.dataset.hb)) PR.actions.uncompletePlan(b.dataset.hb);
          else PR.actions.completePlan(b.dataset.hb, {});
          return;
        }
        if (b.dataset.open) { openId = openId === b.dataset.open ? null : b.dataset.open; PR.app.render(); }
        if (b.dataset.donex) { openId = null; PR.actions.completePlan(b.dataset.donex, {}); }
        if (b.dataset.confirm) {
          var id = b.dataset.confirm;
          var tEl = document.getElementById('c' + id + '-t');
          var qEl = document.getElementById('c' + id + '-q');
          openId = null;
          PR.actions.completePlan(id, { t: tEl ? tEl.value : 0, q: qEl ? qEl.value : 0 });
        }
        if (b.dataset.undo && confirm('완료를 취소할까요? 받은 포인트가 회수됩니다.')) PR.actions.uncompletePlan(b.dataset.undo);
        if (b.id === 'ad-add') {
          var adTitle = document.getElementById('ad-title').value.trim();
          var adWorth = Number(document.getElementById('ad-pts').value);
          if (!adTitle || !adWorth || adWorth < 1) { PR.toast('내용과 가치(P)를 입력해 주세요'); return; }
          PR.actions.addAdhoc(adTitle, adWorth);
        }
        if (b.dataset.addel && confirm('이 기록을 삭제할까요? 받은 포인트가 회수됩니다.')) PR.actions.deleteAdhoc(b.dataset.addel);
        if (b.dataset.ms) {
          var pair = b.dataset.ms.split(':');
          PR.actions.completeMilestone(pair[0], pair[1]);
        }
      };
    },

    onNavAway: function () { openId = null; }
  });
})(window.PR = window.PR || {});
