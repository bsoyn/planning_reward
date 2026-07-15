/* 달력 탭: 월간 예정 + 달성 기록. 날짜를 누르면 그날 상세 */
(function (PR) {
  'use strict';

  var cur = null;      // {y, m} 표시 중인 달
  var selected = null; // 선택된 날짜 'YYYY-MM-DD'

  function initState() {
    if (!cur) {
      var n = new Date();
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
    if (info.dls.length || info.pjs.length) { // 마감일: 미완료 금색 / 전부 완료 초록
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
      rows.push('<div class="hist"><span>🚩 프로젝트 마감: <b>' + PR.esc(pj.title) + '</b></span>' +
        (pj.done ? '<span class="chip d1">완주 ✓</span>' : '') + '</div>');
    });
    info.dls.forEach(function (p) {
      rows.push('<div class="hist"><span>📌 마감: <b>' + PR.esc(p.title) + '</b> <span class="pts">' + p.basePts + 'P</span></span>' +
        (p.done ? '<span class="chip d1">완료 ✓</span>' : (ds < today ? '<span class="chip d3">미완료</span>' : '')) + '</div>');
    });
    info.due.forEach(function (p) {
      var weekly = p.freq && p.freq.type === 'weekly';
      var did = !!info.doneIds[p.id];
      /* 주 n회: 특정일 약속이 아니므로 미래엔 표시 안 함, 과거엔 실제로 한 날만 ✓ */
      if (weekly && ds > today) return;
      if (weekly && ds < today && !did) return;
      var icon = p.kind === 'habit' ? '🌱' : '🔁';
      var mark = '';
      if (ds <= today) mark = did ? '<span class="chip d1">✓</span>'
        : (ds < today && !weekly ? '<span class="chip" style="background:#f0f0f5;color:#999">✗</span>' : '');
      rows.push('<div class="hist"><span>' + icon + ' ' + PR.esc(p.title) +
        (p.duty ? ' <span class="chip" style="background:#e8e8ee;color:#777">의무</span>' : '') + '</span>' + mark + '</div>');
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
        '<span class="cd dl" style="display:inline-block"></span> 마감 <span class="cd dld" style="display:inline-block"></span> 마감 완료</div>';

      return '<h2>달력</h2><div class="card">' + head + grid + legend + '</div>' + detailHtml(selected);
    },

    bind: function (root) {
      root.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.day) { selected = b.dataset.day; PR.app.render(); return; }
        if (b.dataset.cal === 'prev') { cur.m--; if (cur.m < 0) { cur.m = 11; cur.y--; } PR.app.render(); }
        if (b.dataset.cal === 'next') { cur.m++; if (cur.m > 11) { cur.m = 0; cur.y++; } PR.app.render(); }
        if (b.dataset.cal === 'now') {
          var n = new Date();
          cur = { y: n.getFullYear(), m: n.getMonth() };
          selected = PR.todayStr();
          PR.app.render();
        }
      };
    }
  });
})(window.PR = window.PR || {});
