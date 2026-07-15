/* 계획 탭: [1회성 (마감) | 반복] 세그먼트 + 종류별 전용 폼. 프로젝트는 전용 탭으로 분리 */
(function (PR) {
  'use strict';

  var seg = 'deadline';  // 'deadline' | 'routine' | 'habit' | 'proj' — 1회성 목표 우선
  var editing = null;    // 수정 중인 계획

  function switchSeg(next) {
    var v = PR.app.views[seg];
    if (v && v.onNavAway) v.onNavAway();
    editing = null;
    seg = next;
    PR.app.render();
  }

  var RUBRIC = '<div class="sub" style="margin-top:4px">💡 1P ≈ 100원. "남이 시키면 최소 얼마 받을까?" ÷ 100 — 의무(알바·출근·수업) 5~10P · 가볍고 재미있음 10~20P · 무난함 30~50P · 하기 싫고 머리 아픔 80~100P</div>';

  function targetFields(p) {
    return '<label>목표 (선택 · 비우면 O/X 체크)</label>' +
      '<div class="row">' +
        '<div class="grow"><label style="margin-top:0">⏱ 시간 (분)</label>' +
          '<input id="f-tt" type="number" min="1" value="' + (p.targetT || '') + '" placeholder="예: 60"></div>' +
        '<div class="grow"><label style="margin-top:0">🔢 분량</label>' +
          '<input id="f-tq" type="number" min="1" value="' + (p.targetQ || '') + '" placeholder="예: 50"></div>' +
        '<div class="grow"><label style="margin-top:0">단위</label>' +
          '<input id="f-unit" placeholder="쪽/단어/문제" value="' + PR.esc(p.unitQ || '') + '"></div>' +
      '</div>' +
      '<div id="f-mode-wrap" class="hidden"><label>둘 다 입력됨 — 달성 기준</label>' +
        '<select id="f-mode">' +
          '<option value="or"' + (p.mode !== 'and' ? ' selected' : '') + '>둘 중 하나만 채우면 달성 (OR)</option>' +
          '<option value="and"' + (p.mode === 'and' ? ' selected' : '') + '>둘 다 채워야 달성 (AND)</option>' +
        '</select></div>';
  }

  function timeFields(p) {
    return '<label>수행 시간대 (선택 · 이 시간 안에 완료하면 정시 보너스 +30%)</label>' +
      '<div class="row">' +
        '<div class="grow"><input id="f-time" type="time" value="' + (p.time || '') + '"></div>' +
        '<div style="color:var(--sub)">~</div>' +
        '<div class="grow"><input id="f-timeto" type="time" value="' + (p.timeTo || '') + '"></div>' +
      '</div>' +
      '<div class="sub" style="margin-top:4px">끝 시각을 비우면 시작 시각 ±30분 내 완료 시 보너스</div>';
  }

  function commonHead(p, label, ph) {
    return '<div class="row">' +
      '<div class="grow" style="flex:2"><label>' + label + '</label>' +
        '<input id="f-title" placeholder="' + ph + '" value="' + PR.esc(p.title) + '"></div>' +
      '<div class="grow"><label>기본 포인트</label>' +
        '<input id="f-base" type="number" min="1" value="' + (p.basePts || '') + '" placeholder="30"></div>' +
    '</div>' + RUBRIC +
    '<label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-top:10px">' +
      '<input type="checkbox" id="f-duty" style="width:auto"' + (p.duty ? ' checked' : '') + '>' +
      '당연히 해야 하는 의무 (알바·출근·수업 — 스트릭 카운트 제외, 낮은 P 권장)</label>';
  }

  /* ---------------- 반복적인 일 폼 ---------------- */
  function routineForm() {
    var p = (editing && editing.kind === 'routine') ? editing
      : { title: '', basePts: 30, duty: false, targetT: '', targetQ: '', unitQ: '', mode: 'or', time: '', timeTo: '', freq: { type: 'days', days: [] } };
    var f = p.freq || { type: 'days', days: [] };
    var dayBtns = PR.DAYS.map(function (d, i) {
      return '<button type="button" class="' + ((f.days || []).indexOf(i) !== -1 ? 'on' : '') + '" data-day="' + i + '">' + d + '</button>';
    }).join('');
    return '<div class="card">' +
      '<div style="font-weight:700; margin-bottom:2px">' + (editing ? '✏️ 수정' : '➕ 새 반복적인 일') + '</div>' +
      commonHead(p, '이름', '예: 독서, 영어 공부, 알바') +
      targetFields(p) +
      timeFields(p) +
      '<label>반복 방식</label>' +
      '<div class="row">' +
        '<button type="button" class="grow ' + (f.type !== 'weekly' ? '' : 'gray') + '" id="f-ftype-days">요일 고정</button>' +
        '<button type="button" class="grow ' + (f.type === 'weekly' ? '' : 'gray') + '" id="f-ftype-weekly">주 n회</button>' +
      '</div>' +
      '<div id="f-days-wrap" class="' + (f.type === 'weekly' ? 'hidden' : '') + '">' +
        '<label>요일 (선택 안 하면 매일)</label>' +
        '<div class="daybtns" id="f-days">' + dayBtns + '</div>' +
      '</div>' +
      '<div id="f-weekly-wrap" class="' + (f.type === 'weekly' ? '' : 'hidden') + '">' +
        '<label>주당 횟수</label>' +
        '<input id="f-wn" type="number" min="1" max="7" value="' + (f.n || 3) + '">' +
      '</div>' +
      '<div class="row" style="margin-top:12px">' +
        '<button id="f-save-routine" class="grow">' + (editing ? '수정 저장' : '추가') + '</button>' +
        (editing ? '<button id="f-cancel" class="gray">취소</button>' : '') +
      '</div>' +
    '</div>';
  }

  /* ---------------- 1회성 (마감) 폼 ---------------- */
  function deadlineForm() {
    var p = (editing && editing.kind === 'deadline') ? editing
      : { title: '', basePts: 50, duty: false, targetT: '', targetQ: '', unitQ: '', mode: 'or', time: '', timeTo: '', deadline: '' };
    return '<div class="card">' +
      '<div style="font-weight:700; margin-bottom:2px">' + (editing ? '✏️ 수정' : '➕ 새 1회성 목표') + '</div>' +
      commonHead(p, '이름', '예: 보고서 제출, 과제') +
      targetFields(p) +
      timeFields(p) +
      '<label>마감일 (일찍 끝낼수록 보너스 ↑, 지나면 지급 50%)</label>' +
      '<input id="f-deadline" type="date" value="' + (p.deadline || '') + '">' +
      '<div class="row" style="margin-top:12px">' +
        '<button id="f-save-deadline" class="grow">' + (editing ? '수정 저장' : '추가') + '</button>' +
        (editing ? '<button id="f-cancel" class="gray">취소</button>' : '') +
      '</div>' +
    '</div>';
  }

  function planList(kind) {
    var S = PR.store.state;
    var list = S.plans.filter(function (p) { return p.kind === kind; });
    var items = list.length ? list.map(function (pl) {
      return '<div class="plan ' + (pl.done ? 'done' : '') + '">' +
        '<div class="grow">' +
          '<div class="t">' + PR.esc(pl.title) + (pl.done ? ' <span class="chip d1">완료됨</span>' : '') + '</div>' +
          '<div style="margin-top:4px">' + PR.vh.planChips(pl) + ' <span class="sub">기본 ' + pl.basePts + 'P</span></div>' +
        '</div>' +
        (pl.done ? '<button class="gray small" data-undone="' + pl.id + '">완료 취소</button>' : '') +
        '<button class="ghost small" data-edit="' + pl.id + '">수정</button>' +
        '<button class="danger small" data-del="' + pl.id + '">삭제</button>' +
      '</div>';
    }).join('') : '<div class="empty">아직 없어요</div>';
    return '<div class="card">' + items + '</div>';
  }

  var RULES = '<div class="card sub" style="line-height:1.7">💡 <b>지급 규칙</b><br>' +
    '지급 = 기본P × 달성률² (부분 달성은 깎여서: 50% 달성 → 25%)<br>' +
    '완전 달성 시: 스트릭 +2%/일(최대 +50%) · 시간대 내 완료 +30%<br>' +
    '초과 달성: 초과분의 절반 요율, 최대 +50%<br>' +
    '의무 항목은 스트릭 카운트에서 제외</div>';

  /* ---------------- 제출 ---------------- */
  function readTargets() {
    return {
      targetT: Number(document.getElementById('f-tt').value) || null,
      targetQ: Number(document.getElementById('f-tq').value) || null,
      unitQ: (document.getElementById('f-unit').value || '').trim(),
      mode: document.getElementById('f-mode').value
    };
  }

  function submitCommon(kind) {
    var title = document.getElementById('f-title').value.trim();
    var base = Number(document.getElementById('f-base').value);
    if (!title) { PR.toast('이름을 입력해 주세요'); return null; }
    if (!base || base < 1) { PR.toast('기본 포인트를 입력해 주세요'); return null; }
    return Object.assign({
      id: editing ? editing.id : PR.uid(),
      title: title, kind: kind, basePts: base,
      duty: document.getElementById('f-duty').checked,
      time: document.getElementById('f-time').value || '',
      timeTo: document.getElementById('f-timeto').value || '',
      freq: { type: 'days', days: [] }, deadline: '',
      createdAt: editing ? (editing.createdAt || PR.todayStr()) : PR.todayStr(),
      done: editing ? !!editing.done : false,
      active: true
    }, readTargets());
  }

  function submitRoutine() {
    var p = submitCommon('routine');
    if (!p) return;
    var weekly = !document.getElementById('f-weekly-wrap').classList.contains('hidden');
    p.freq = weekly
      ? { type: 'weekly', n: Math.min(7, Math.max(1, Number(document.getElementById('f-wn').value) || 3)) }
      : { type: 'days', days: Array.prototype.map.call(document.querySelectorAll('#f-days button.on'), function (b) { return Number(b.dataset.day); }) };
    var isEdit = !!editing;
    editing = null;
    PR.actions.savePlan(p, isEdit);
  }

  function submitDeadline() {
    var p = submitCommon('deadline');
    if (!p) return;
    p.deadline = document.getElementById('f-deadline').value || '';
    if (!p.deadline) { PR.toast('마감일을 입력해 주세요'); return; }
    var isEdit = !!editing;
    editing = null;
    PR.actions.savePlan(p, isEdit);
  }

  /* ---------------- 컴포넌트 ---------------- */
  PR.app.register('plans', {
    render: function () {
      var segBtns = '<div class="row" style="margin-bottom:10px">' +
        '<button class="grow small ' + (seg === 'deadline' ? '' : 'gray') + '" data-seg="deadline">📅 1회성</button>' +
        '<button class="grow small ' + (seg === 'routine' ? '' : 'gray') + '" data-seg="routine">🔁 반복</button>' +
        '<button class="grow small ' + (seg === 'habit' ? '' : 'gray') + '" data-seg="habit">🌱 습관</button>' +
        '<button class="grow small ' + (seg === 'proj' ? '' : 'gray') + '" data-seg="proj">🚩 프로젝트</button></div>';
      var body;
      if (seg === 'habit' || seg === 'proj') {
        body = PR.app.views[seg].render().replace(/^<h2>[^<]*<\/h2>/, '');
      } else if (seg === 'deadline') {
        body = deadlineForm() + planList('deadline') + RULES;
      } else {
        body = routineForm() + planList('routine') + RULES;
      }
      return '<h2>계획 관리</h2>' + segBtns + body;
    },

    bind: function (root) {
      if (seg === 'habit' || seg === 'proj') {
        var v = PR.app.views[seg];
        if (v && v.bind) v.bind(root);
        var sub = root.onclick;
        root.onclick = function (e) {
          var sb = e.target.closest('button');
          if (sb && sb.dataset.seg) { switchSeg(sb.dataset.seg); return; }
          if (sub) sub(e);
        };
        return;
      }
      root.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.seg) { switchSeg(b.dataset.seg); return; }
        if (b.dataset.day !== undefined && b.dataset.day !== '') { b.classList.toggle('on'); return; }
        if (b.id === 'f-ftype-days' || b.id === 'f-ftype-weekly') {
          var weekly = b.id === 'f-ftype-weekly';
          document.getElementById('f-days-wrap').classList.toggle('hidden', weekly);
          document.getElementById('f-weekly-wrap').classList.toggle('hidden', !weekly);
          document.getElementById('f-ftype-days').className = 'grow ' + (weekly ? 'gray' : '');
          document.getElementById('f-ftype-weekly').className = 'grow ' + (weekly ? '' : 'gray');
          return;
        }
        if (b.id === 'f-save-routine') submitRoutine();
        if (b.id === 'f-save-deadline') submitDeadline();
        if (b.id === 'f-cancel') { editing = null; PR.app.render(); }
        if (b.dataset.edit) {
          editing = JSON.parse(JSON.stringify(PR.store.state.plans.find(function (p) { return p.id === b.dataset.edit; })));
          seg = editing.kind === 'deadline' ? 'deadline' : 'routine';
          PR.app.render();
        }
        if (b.dataset.del && confirm('삭제할까요? (기록은 유지됩니다)')) PR.actions.deletePlan(b.dataset.del);
        if (b.dataset.undone && confirm('완료를 취소할까요? 받은 포인트가 회수됩니다.')) PR.actions.uncompletePlan(b.dataset.undone);
      };

      /* T/Q 둘 다 입력 시 모드 선택 표시 */
      var tt = document.getElementById('f-tt');
      if (tt) {
        var updMode = function () {
          var both = document.getElementById('f-tt').value && document.getElementById('f-tq').value;
          document.getElementById('f-mode-wrap').classList.toggle('hidden', !both);
        };
        tt.oninput = updMode;
        document.getElementById('f-tq').oninput = updMode;
        updMode();
      }
    },

    onNavAway: function () {
      editing = null;
      ['habit', 'proj'].forEach(function (n) {
        var v = PR.app.views[n];
        if (v && v.onNavAway) v.onNavAway();
      });
    }
  });
})(window.PR = window.PR || {});
