/* 습관 탭: 해빗트래커 그리드 (최근 7일) + 습관 관리
   습관 = 정해진 시각 없이 주기적으로 하면 좋은 것. 단순 O/X 체크. */
(function (PR) {
  'use strict';

  var editing = null;

  function habits() {
    return PR.store.state.plans.filter(function (p) { return p.kind === 'habit' && p.active; });
  }

  function last7() {
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      out.push(PR.todayStr(d));
    }
    return out;
  }

  function gridHtml() {
    /* 반복 기간이 끝난 습관은 그리드에서 제외 (아래 '습관 관리'에는 그대로 보임) */
    var hs = habits().filter(function (p) { return !PR.sched.isExpired(p); });
    if (!hs.length) return '<div class="card"><div class="empty">습관을 추가해 보세요!<br>물 마시기, 스트레칭, 일기 쓰기 같은 것들 🌱</div></div>';
    var days = last7();
    var today = PR.todayStr();
    var logsBy = {};
    PR.store.state.logs.forEach(function (l) { logsBy[l.planId + '|' + l.date] = l.full; });

    var head = '<div class="hgrid" style="margin-bottom:2px"><div></div>' + days.map(function (ds) {
      var d = new Date(ds + 'T12:00:00');
      return '<div class="sub" style="text-align:center">' + PR.DAYS[d.getDay()] + '<br>' + d.getDate() + '</div>';
    }).join('') + '</div>';

    var rows = hs.map(function (p) {
      var st = PR.sched.planStreak(p);
      var quota = '';
      if (p.freq && p.freq.type === 'weekly') {
        var k = PR.sched.weekFullCount(p.id);
        quota = ' · 이번 주 ' + Math.min(k, p.freq.n) + '/' + p.freq.n + (k >= p.freq.n ? ' ✓' : '');
      }
      var cells = days.map(function (ds) {
        var done = !!logsBy[p.id + '|' + ds];
        var sched = PR.sched.isScheduledOn(p, ds);
        if (ds === today) {
          return '<button class="hcell today ' + (done ? 'done' : '') + '" data-hb="' + p.id + '" data-hbd="' + ds + '">' + (done ? '✓' : '') + '</button>';
        }
        if (sched) { // 지난 날도 체크/해제 가능 (소급: 보너스 없이 지급, 스트릭 날짜는 인정)
          return '<button class="hcell ' + (done ? 'done' : '') + '" data-hb="' + p.id + '" data-hbd="' + ds + '">' + (done ? '✓' : '') + '</button>';
        }
        return '<div class="hcell off">' + (done ? '✓' : '') + '</div>';
      }).join('');
      return '<div class="hgrid"><div style="min-width:0">' +
        '<div class="t" style="font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">' + PR.esc(p.title) + '</div>' +
        '<div class="sub">🔥' + st.n + st.unit + ' · +' + p.basePts + 'P' + quota + '</div>' +
      '</div>' + cells + '</div>';
    }).join('');

    return '<div class="card">' + head + rows +
      '<div class="sub" style="margin-top:8px">칸을 눌러 체크/해제 — 지난 날도 가능 (소급은 보너스 없이 지급) · 흐린 칸은 예정일 아님</div></div>';
  }

  function formHtml() {
    var p = editing || { title: '', basePts: 10, freq: { type: 'days', days: [] }, startDate: PR.todayStr(), endDate: '' };
    var f = p.freq || { type: 'days', days: [] };
    var dayBtns = PR.DAYS.map(function (d, i) {
      return '<button type="button" class="' + ((f.days || []).indexOf(i) !== -1 ? 'on' : '') + '" data-day="' + i + '">' + d + '</button>';
    }).join('');
    return '<div class="card">' +
      '<div style="font-weight:700; margin-bottom:2px">' + (editing ? '✏️ 습관 수정' : '➕ 새 습관') + '</div>' +
      '<div class="row">' +
        '<div class="grow" style="flex:2"><label>습관 이름</label>' +
          '<input id="h-title" placeholder="예: 물 2L, 스트레칭" value="' + PR.esc(p.title) + '"></div>' +
        '<div class="grow"><label>포인트</label>' +
          '<input id="h-base" type="number" min="1" value="' + (p.basePts || '') + '"></div>' +
      '</div>' +
      '<div class="sub" style="margin-top:4px">습관은 가볍게 5~20P 권장</div>' +
      '<label>반복 방식</label>' +
      '<div class="row">' +
        '<button type="button" class="grow ' + (f.type !== 'weekly' ? '' : 'gray') + '" id="h-ftype-days">요일 고정</button>' +
        '<button type="button" class="grow ' + (f.type === 'weekly' ? '' : 'gray') + '" id="h-ftype-weekly">주 n회</button>' +
      '</div>' +
      '<div id="h-days-wrap" class="' + (f.type === 'weekly' ? 'hidden' : '') + '">' +
        '<label>요일 (선택 안 하면 매일)</label>' +
        '<div class="daybtns" id="h-days">' + dayBtns + '</div>' +
      '</div>' +
      '<div id="h-weekly-wrap" class="' + (f.type === 'weekly' ? '' : 'hidden') + '">' +
        '<label>주당 횟수</label>' +
        '<input id="h-wn" type="number" min="1" max="7" value="' + (f.n || 3) + '">' +
      '</div>' +
      PR.vh.rangeFields(p, 'h') +
      '<div class="row" style="margin-top:12px">' +
        '<button id="h-save" class="grow">' + (editing ? '수정 저장' : '습관 추가') + '</button>' +
        (editing ? '<button id="h-cancel" class="gray">취소</button>' : '') +
      '</div>' +
    '</div>';
  }

  function listHtml() {
    var hs = habits();
    if (!hs.length) return '';
    return '<div class="card"><details><summary>습관 관리 (' + hs.length + ')</summary>' +
      hs.map(function (p) {
        var f = p.freq || { type: 'days', days: [] };
        var dd = f.type === 'weekly' ? '주 ' + f.n + '회'
          : (f.days && f.days.length) ? f.days.map(function (d) { return PR.DAYS[d]; }).join('') : '매일';
        var period = PR.sched.isExpired(p) ? ' · <span style="color:var(--sub)">기간 종료(' + p.endDate + ')</span>'
          : (p.endDate ? ' · ~' + p.endDate : '');
        return '<div class="plan"><div class="grow"><div class="t">' + PR.esc(p.title) + '</div>' +
          '<div class="sub">' + dd + ' · +' + p.basePts + 'P' + period + '</div></div>' +
          '<button class="ghost small" data-hedit="' + p.id + '">수정</button>' +
          '<button class="danger small" data-hdel="' + p.id + '">삭제</button></div>';
      }).join('') + '</details></div>';
  }

  function submit() {
    var title = document.getElementById('h-title').value.trim();
    var base = Number(document.getElementById('h-base').value);
    if (!title) { PR.toast('습관 이름을 입력해 주세요'); return; }
    if (!base || base < 1) { PR.toast('포인트를 입력해 주세요'); return; }
    var range = PR.vh.readRange('h');
    if (!range) return;
    var weekly = !document.getElementById('h-weekly-wrap').classList.contains('hidden');
    var p = {
      id: editing ? editing.id : PR.uid(),
      title: title, kind: 'habit', basePts: base, duty: false,
      targetT: null, targetQ: null, unitQ: '', mode: 'or', time: '',
      freq: weekly
        ? { type: 'weekly', n: Math.min(7, Math.max(1, Number(document.getElementById('h-wn').value) || 3)) }
        : { type: 'days', days: Array.prototype.map.call(document.querySelectorAll('#h-days button.on'), function (b) { return Number(b.dataset.day); }) },
      startDate: range.startDate, endDate: range.endDate,
      deadline: '', createdAt: editing ? editing.createdAt : PR.todayStr(),
      done: false, active: true
    };
    var isEdit = !!editing;
    editing = null;
    PR.actions.savePlan(p, isEdit);
  }

  PR.app.register('habit', {
    render: function () {
      return '<h2>습관 트래커</h2>' + gridHtml() + formHtml() + listHtml();
    },

    bind: function (root) {
      root.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.hb) { // 날짜 칸 토글 (오늘 + 지난 7일)
          var ds = b.dataset.hbd || PR.todayStr();
          var has = PR.store.state.logs.some(function (l) { return l.planId === b.dataset.hb && l.date === ds; });
          if (has) PR.actions.uncompletePlan(b.dataset.hb, ds);
          else PR.actions.completePlan(b.dataset.hb, { date: ds });
          return;
        }
        if (b.dataset.day !== undefined && b.dataset.day !== '') { b.classList.toggle('on'); return; }
        if (b.id === 'h-ftype-days' || b.id === 'h-ftype-weekly') {
          var weekly = b.id === 'h-ftype-weekly';
          document.getElementById('h-days-wrap').classList.toggle('hidden', weekly);
          document.getElementById('h-weekly-wrap').classList.toggle('hidden', !weekly);
          document.getElementById('h-ftype-days').className = 'grow ' + (weekly ? 'gray' : '');
          document.getElementById('h-ftype-weekly').className = 'grow ' + (weekly ? '' : 'gray');
          return;
        }
        if (b.id === 'h-save') submit();
        if (b.id === 'h-cancel') { editing = null; PR.app.render(); }
        if (b.dataset.hedit) {
          editing = JSON.parse(JSON.stringify(PR.store.state.plans.find(function (p) { return p.id === b.dataset.hedit; })));
          PR.app.render();
        }
        if (b.dataset.hdel && confirm('이 습관을 삭제할까요? (기록은 유지됩니다)')) PR.actions.deletePlan(b.dataset.hdel);
      };
    },

    onNavAway: function () { editing = null; }
  });
})(window.PR = window.PR || {});
