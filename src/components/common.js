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
    }
    if (p.kind === 'deadline' && p.deadline) {
      var left = PR.daysBetween(PR.todayStr(), p.deadline);
      var lbl = left < 0 ? '마감 지남' : left === 0 ? 'D-day' : 'D-' + left;
      c += '<span class="chip ' + (left <= 3 ? 'd3' : 'time') + '">📅 ' + lbl + '</span>';
    }
    return c;
  }

  /* 진행률 바 (프로젝트) */
  function progressBar(done, total) {
    var pct = total ? Math.round(done / total * 100) : 0;
    return '<div class="pbar"><div style="width:' + pct + '%"></div></div>' +
      '<div class="sub" style="margin-top:3px">' + done + '/' + total + ' 단계 (' + pct + '%)</div>';
  }

  /* 완료 입력 폼 (목표가 있는 계획용). idPrefix로 요소 구분 */
  function completeForm(p, idPrefix) {
    var h = '<div class="cform" id="' + idPrefix + '-form">';
    if (p.targetT) h += '<div class="grow"><label>실제 시간 (분)</label><input type="number" min="0" id="' + idPrefix + '-t" value="' + p.targetT + '"></div>';
    if (p.targetQ) h += '<div class="grow"><label>실제 분량 (' + PR.esc(p.unitQ || '개') + ')</label><input type="number" min="0" id="' + idPrefix + '-q" value="' + p.targetQ + '"></div>';
    h += '<button data-confirm="' + p.id + '" style="align-self:flex-end">지급</button></div>';
    return h;
  }

  PR.vh = { planChips: planChips, progressBar: progressBar, completeForm: completeForm };
})(window.PR = window.PR || {});
