/* 컴포넌트 공용 뷰 헬퍼 */
(function (PR) {
  'use strict';

  function planChips(p) {
    var c = '';
    if (p.targetT) c += '<span class="chip">⏱ ' + p.targetT + '분</span>';
    if (p.targetQ) c += '<span class="chip">🔢 ' + p.targetQ + (p.unitQ || '개') + '</span>';
    if (p.targetT && p.targetQ) c += '<span class="chip" style="background:#f0e8fd;color:#8b5cf6">' + (p.mode === 'and' ? '둘 다' : '둘 중 하나') + '</span>';
    if (!p.targetT && !p.targetQ) c += '<span class="chip">✔ O/X</span>';
    if (p.time) c += '<span class="chip time">⏰ ' + p.time + (p.timeTo ? '~' + p.timeTo : '') + '</span>';
    if (p.duty) c += '<span class="chip" style="background:#e8e8ee;color:#777">의무</span>';
    if (p.kind === 'habit' || p.kind === 'routine') {
      var f = p.freq || { type: 'days', days: [] };
      var dd = f.type === 'weekly' ? '주 ' + f.n + '회'
        : (f.days && f.days.length) ? f.days.map(function (d) { return PR.DAYS[d]; }).join('') : '매일';
      c += '<span class="chip" style="background:#f0f0f5;color:#999">' + dd + '</span>';
      /* 반복 기간: 아직 시작 전이거나 종료일이 있을 때만 표시 (평소엔 칩을 늘리지 않음) */
      var today = PR.todayStr();
      if (p.startDate && p.startDate > today) {
        c += '<span class="chip time">🗓 ' + p.startDate.slice(5).replace('-', '/') + ' 시작</span>';
      }
      if (p.endDate) {
        c += p.endDate < today
          ? '<span class="chip" style="background:#f0f0f5;color:#999">기간 종료</span>'
          : '<span class="chip time">~' + p.endDate.slice(5).replace('-', '/') + '</span>';
      }
    }
    if (p.kind === 'deadline' && p.deadline) {
      var left = PR.daysBetween(PR.todayStr(), p.deadline);
      var lbl = left < 0 ? '마감 지남' : left === 0 ? 'D-day' : 'D-' + left;
      c += '<span class="chip ' + (left <= 3 ? 'd3' : 'time') + '">📅 ' + lbl + '</span>';
    }
    return c;
  }

  /* 반복 기간 입력 (습관/반복적인 일). idPrefix: 'f'(계획) | 'h'(습관) */
  function rangeFields(p, idPrefix) {
    return '<label>반복 기간 (종료일은 비워도 됨)</label>' +
      '<div class="row">' +
        '<div class="grow"><input id="' + idPrefix + '-start" type="date" value="' + (p.startDate || '') + '"></div>' +
        '<div style="color:var(--sub)">~</div>' +
        '<div class="grow"><input id="' + idPrefix + '-end" type="date" value="' + (p.endDate || '') + '"></div>' +
      '</div>' +
      '<div class="sub" style="margin-top:2px">시작일 이전 날짜에는 이 계획이 아예 안 나타나요 — 달력·달성률·연속 일수 모두 제외</div>';
  }

  /* 반복 기간 읽기. 범위가 잘못되면 토스트 후 null */
  function readRange(idPrefix) {
    var s = document.getElementById(idPrefix + '-start');
    var e = document.getElementById(idPrefix + '-end');
    var startDate = s ? (s.value || '') : '';
    var endDate = e ? (e.value || '') : '';
    if (startDate && endDate && endDate < startDate) {
      PR.toast('종료일이 시작일보다 빨라요');
      return null;
    }
    return { startDate: startDate, endDate: endDate };
  }

  /* 진행률 바 (프로젝트) */
  function progressBar(done, total) {
    var pct = total ? Math.round(done / total * 100) : 0;
    return '<div class="pbar"><div style="width:' + pct + '%"></div></div>' +
      '<div class="sub" style="margin-top:3px">' + done + '/' + total + ' 단계 (' + pct + '%)</div>';
  }

  /* 완료 입력이 필요한 계획인지 (목표치 입력 / 정시 확인 / 완료일 선택) */
  function needsForm(p, forceOnTime) {
    if (p.targetT || p.targetQ || p.kind === 'deadline') return true;
    if (!p.time) return false;
    if (forceOnTime) return true;
    var n = new Date();
    return !PR.points.inWindow(p, n.getHours() * 60 + n.getMinutes());
  }

  /* 완료 폼에서 입력값 읽기 (요소가 없으면 그 항목은 생략) */
  function readCompleteForm(idPrefix) {
    var g = function (s) { return document.getElementById(idPrefix + '-' + s); };
    var tEl = g('t'), qEl = g('q'), dEl = g('d'), tmEl = g('tm');
    return {
      t: tEl ? tEl.value : 0,
      q: qEl ? qEl.value : 0,
      date: dEl ? dEl.value : undefined,
      ontime: tmEl ? tmEl.checked : undefined
    };
  }

  /* 완료 입력 폼 (목표가 있는 계획용). idPrefix로 요소 구분.
     opts.forceOnTime: 지금 시각과 무관하게 정시 체크박스를 띄운다 (지난 날 소급 완료용) */
  function completeForm(p, idPrefix, opts) {
    opts = opts || {};
    var h = '<div class="cform" id="' + idPrefix + '-form">';
    if (p.kind === 'deadline') {
      var today = PR.todayStr();
      h += '<div class="grow"><label>실제 완료한 날짜</label><input type="date" id="' + idPrefix + '-d" value="' + today + '" max="' + today + '"' + (p.createdAt ? ' min="' + p.createdAt + '"' : '') + '></div>';
    }
    if (p.time) {
      var n = new Date();
      var within = !opts.forceOnTime && PR.points.inWindow(p, n.getHours() * 60 + n.getMinutes());
      if (!within) { // 지금이 시간대 안이면 물어볼 필요 없이 자동 인정 (체크박스 생략)
        h += '<label style="display:flex; align-items:center; gap:6px; cursor:pointer; flex-basis:100%; margin:0 0 2px">' +
          '<input type="checkbox" id="' + idPrefix + '-tm" style="width:auto">' +
          '시간대(' + p.time + (p.timeTo ? '~' + p.timeTo : ' ±30분') + ') 안에 완료했었어요 (+30%)</label>';
      }
    }
    if (p.targetT) h += '<div class="grow"><label>실제 시간 (분)</label><input type="number" min="0" id="' + idPrefix + '-t" value="' + p.targetT + '"></div>';
    if (p.targetQ) h += '<div class="grow"><label>실제 분량 (' + PR.esc(p.unitQ || '개') + ')</label><input type="number" min="0" id="' + idPrefix + '-q" value="' + p.targetQ + '"></div>';
    h += '<button data-confirm="' + p.id + '" style="align-self:flex-end">지급</button>';
    if (p.kind === 'deadline') {
      h += '<div class="sub" style="flex-basis:100%">뒤늦게 기록하는 경우 실제 완료일을 고르세요 — 마감 내였다면 지각 감액이 없어요 (소급 기록은 보너스 제외)</div>';
    }
    h += '</div>';
    return h;
  }

  PR.vh = { planChips: planChips, rangeFields: rangeFields, readRange: readRange,
            progressBar: progressBar, completeForm: completeForm,
            needsForm: needsForm, readCompleteForm: readCompleteForm };
})(window.PR = window.PR || {});
