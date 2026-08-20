/* 달력 탭: 월간 예정 + 달성 기록. 날짜를 누르면 그날 상세.
   상세에서 지난 날짜도 뒤늦게 완료/취소할 수 있다 (RETRO_DAYS 이내).
   소급 완료는 스트릭·정시·서프라이즈 보너스가 붙지 않지만(points.js의 retro 처리),
   그 날 때문에 소모된 방어막·차감 포인트는 되돌려 받는다(actions.restoreForDate). */
(function (PR) {
  'use strict';

  var cur = null;      // {y, m} 표시 중인 달
  var selected = null; // 선택된 날짜 'YYYY-MM-DD'
  var openId = null;   // 소급 완료 입력 폼이 열린 계획 id

  var RETRO_DAYS = 14; // 이 기간 안의 지난 날만 뒤늦게 손댈 수 있음

  /* 그 날짜를 지금 완료/취소할 수 있는지 (미래 불가, 너무 오래된 과거도 불가) */
  function canAct(ds) {
    var today = PR.todayStr();
    if (ds > today) return false;
    return PR.daysBetween(ds, today) <= RETRO_DAYS;
  }

  function initState() {
    if (!cur) {
      var n = PR.todayDate();
      cur = { y: n.getFullYear(), m: n.getMonth() };
      selected = PR.todayStr();
    }
  }

  /* 해당 날짜의 예정/기록 요약 */
  function dayInfo(ds) {
    var S = PR.store.state;
    var due = S.plans.filter(function (p) { return PR.sched.isScheduledOn(p, ds); });
    /* 주 n회형은 특정 날짜의 약속이 아니므로 예정 점 대상에서 제외 */
    var dueFixed = due.filter(function (p) { return !p.freq || p.freq.type !== 'weekly'; });
    var dls = S.plans.filter(function (p) { return p.kind === 'deadline' && p.active && p.deadline === ds; });
    var pjs = S.projects.filter(function (pj) { return pj.deadline === ds; });
    var doneIds = {};
    S.logs.forEach(function (l) { if (l.date === ds && l.full) doneIds[l.planId] = 1; });
    var adhoc = S.logs.filter(function (l) { return l.adhoc && l.date === ds; });
    var frozen = (S.frozenDates || []).indexOf(ds) !== -1;
    return { due: due, dueFixed: dueFixed, dls: dls, pjs: pjs, doneIds: doneIds, adhoc: adhoc, frozen: frozen };
  }

  function cellHtml(ds, dayNum) {
    var today = PR.todayStr();
    var info = dayInfo(ds);
    var cls = 'cal-cell';
    if (ds === today) cls += ' today';
    if (ds === selected) cls += ' sel';
    if (ds < today) { // 지난 날: 결과 색
      if (info.frozen) cls += ' frozen';
      else if (PR.points.metOn(ds)) cls += ' ok';
      else if (PR.points.obligationOn(ds)) cls += ' miss';
    }
    var dots = '';
    if (info.dueFixed.length) dots += '<span class="cd"></span>';
    if (info.dls.length || info.pjs.length) { // 목표일: 미완료 금색 / 전부 완료 초록
      var allDone = info.dls.every(function (x) { return x.done; }) && info.pjs.every(function (x) { return x.done; });
      dots += '<span class="cd ' + (allDone ? 'dld' : 'dl') + '"></span>';
    }
    return '<button class="' + cls + '" data-day="' + ds + '">' + dayNum +
      '<span class="cdots">' + dots + '</span></button>';
  }

  function detailHtml(ds) {
    var S = PR.store.state;
    var today = PR.todayStr();
    var info = dayInfo(ds);
    var d = new Date(ds + 'T12:00:00');
    var rows = [];

    if (info.frozen) rows.push('<div class="hist"><span>🛡 방어막으로 보호된 날</span></div>');
    info.pjs.forEach(function (pj) {
      rows.push('<div class="hist"><span>🚩 프로젝트 목표일: <b>' + PR.esc(pj.title) + '</b></span>' +
        (pj.done ? '<span class="chip d1">완주 ✓</span>' : '') + '</div>');
    });
    info.dls.forEach(function (p) {
      rows.push('<div class="hist"><span>📌 목표일: <b>' + PR.esc(p.title) + '</b>' + (p.basePts ? ' <span class="pts">' + p.basePts + 'P</span>' : '') + '</span>' +
        (p.done ? '<span class="chip d1">완료 ✓</span>' : (ds < today ? '<span class="chip d3">미완료</span>' : '')) + '</div>');
    });
    var act = canAct(ds);
    info.due.forEach(function (p) {
      var weekly = p.freq && p.freq.type === 'weekly';
      var did = !!info.doneIds[p.id];
      /* 주 n회: 특정일 약속이 아니므로 미래엔 표시 안 함.
         과거엔 실제로 한 날만 ✓ — 단 소급 가능 기간이면 "그날 했었다"고 기록할 수 있게 보여준다 */
      if (weekly && ds > today) return;
      if (weekly && ds < today && !did && !act) return;
      var icon = p.kind === 'habit' ? '🌱' : '🔁';
      var mark = '';
      if (ds <= today) mark = did ? '<span class="chip d1">✓</span>'
        : (ds < today && !weekly ? '<span class="chip" style="background:#f0f0f5;color:#999">✗</span>' : '');

      var btn = '';
      if (act) {
        if (did) {
          btn = '<button class="gray small" data-cundo="' + p.id + '">취소</button>';
        } else if (PR.vh.needsForm(p, true)) {
          btn = '<button class="small ' + (openId === p.id ? 'gray' : '') + '" data-copen="' + p.id + '">' +
            (openId === p.id ? '닫기' : '완료') + '</button>';
        } else {
          btn = '<button class="small" data-cdone="' + p.id + '">완료</button>';
        }
      }
      rows.push('<div class="hist"><span>' + icon + ' ' + PR.esc(p.title) +
        (p.duty ? ' <span class="chip" style="background:#e8e8ee;color:#777">의무</span>' : '') + '</span>' +
        '<span>' + mark + ' ' + btn + '</span></div>');
      if (act && !did && openId === p.id) {
        rows.push(PR.vh.completeForm(p, 'k' + p.id, { forceOnTime: true }));
      }
    });
    info.adhoc.forEach(function (l) {
      rows.push('<div class="hist"><span>🔖 ' + PR.esc(l.title || '') + '</span><span class="pts">+' + l.pts + 'P</span></div>');
    });
    var dayPts = S.logs.filter(function (l) { return l.date === ds; })
      .reduce(function (a, l) { return a + l.pts; }, 0);

    return '<div class="card">' +
      '<div class="row"><div class="grow" style="font-weight:700">' +
        (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + PR.DAYS[d.getDay()] + ')' +
        (ds === today ? ' <span class="chip">오늘</span>' : '') + '</div>' +
        (dayPts ? '<span class="pts">' + (dayPts > 0 ? '+' : '') + dayPts + 'P</span>' : '') + '</div>' +
      (rows.length ? '<div style="margin-top:6px">' + rows.join('') + '</div>'
        : '<div class="empty" style="padding:14px 0">이날은 예정도 기록도 없어요</div>') +
      (ds < today && act
        ? '<div class="sub" style="margin-top:8px">🕓 지난 날도 여기서 완료할 수 있어요 — 그날 쓴 방어막·차감 포인트는 돌려받고, 스트릭·정시·서프라이즈 보너스는 빠져요</div>'
        : '') +
      (ds < today && !act
        ? '<div class="sub" style="margin-top:8px">' + RETRO_DAYS + '일이 지난 날은 수정할 수 없어요</div>'
        : '') +
    '</div>';
  }

  PR.app.register('cal', {
    render: function () {
      initState();
      var first = new Date(cur.y, cur.m, 1);
      var startWd = first.getDay();
      var dim = new Date(cur.y, cur.m + 1, 0).getDate();

      var head = '<div class="calhead">' +
        '<button class="ghost small" data-cal="prev">‹</button>' +
        '<div style="font-weight:700">' + cur.y + '년 ' + (cur.m + 1) + '월</div>' +
        '<div class="row"><button class="ghost small" data-cal="now">오늘</button>' +
        '<button class="ghost small" data-cal="next">›</button></div></div>';

      var grid = '<div class="calgrid">' +
        PR.DAYS.map(function (w) { return '<div class="calwd">' + w + '</div>'; }).join('');
      for (var b = 0; b < startWd; b++) grid += '<div class="cal-cell blank"></div>';
      for (var day = 1; day <= dim; day++) {
        var ds = cur.y + '-' + String(cur.m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        grid += cellHtml(ds, day);
      }
      grid += '</div>';

      var legend = '<div class="sub" style="margin-top:8px">' +
        '<span class="cal-lg ok"></span>달성 <span class="cal-lg miss"></span>놓침 ' +
        '<span class="cal-lg frozen"></span>방어막 · <span class="cd" style="display:inline-block"></span> 예정 ' +
        '<span class="cd dl" style="display:inline-block"></span> 목표일 <span class="cd dld" style="display:inline-block"></span> 목표 완료</div>';

      return '<h2>달력</h2><div class="card">' + head + grid + legend + '</div>' + detailHtml(selected);
    },

    bind: function (root) {
      root.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.day) { selected = b.dataset.day; openId = null; PR.app.render(); return; }
        if (b.dataset.cal === 'prev') { cur.m--; if (cur.m < 0) { cur.m = 11; cur.y--; } openId = null; PR.app.render(); }
        if (b.dataset.cal === 'next') { cur.m++; if (cur.m > 11) { cur.m = 0; cur.y++; } openId = null; PR.app.render(); }
        if (b.dataset.cal === 'now') {
          var n = PR.todayDate();
          cur = { y: n.getFullYear(), m: n.getMonth() };
          selected = PR.todayStr();
          openId = null;
          PR.app.render();
        }

        /* ---- 그 날짜에 대한 완료/취소 (소급 기록) ---- */
        if (b.dataset.copen) { openId = openId === b.dataset.copen ? null : b.dataset.copen; PR.app.render(); }
        if (b.dataset.cdone) { openId = null; PR.actions.completePlan(b.dataset.cdone, { date: selected }); }
        if (b.dataset.confirm) {
          var id = b.dataset.confirm;
          var input = PR.vh.readCompleteForm('k' + id);
          input.date = selected; // 달력에서는 선택한 날짜로 고정
          openId = null;
          PR.actions.completePlan(id, input);
        }
        if (b.dataset.cundo && confirm('이 날의 완료를 취소할까요? 받은 포인트가 회수됩니다.')) {
          PR.actions.uncompletePlan(b.dataset.cundo, selected);
        }
      };
    },

    onNavAway: function () { openId = null; }
  });
})(window.PR = window.PR || {});
