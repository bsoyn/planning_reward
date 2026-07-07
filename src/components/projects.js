/* 프로젝트 탭: 마일스톤 관리 (계획 탭에서 분리) */
(function (PR) {
  'use strict';

  function projForm() {
    return '' +
      '<div class="card">' +
        '<div style="font-weight:700; margin-bottom:2px">🚩 새 프로젝트</div>' +
        '<div class="sub" style="margin-top:4px; line-height:1.6">크고 막연한 일을 단계로 쪼개세요. 단계에 총액의 60~70%, 완주 보너스에 30~40% 배분을 권장. 단계 포인트는 시작할 때 확정하는 게 원칙!</div>' +
        '<label>프로젝트 이름</label>' +
        '<input id="pj-title" placeholder="예: 포트폴리오 완성">' +
        '<div class="row">' +
          '<div class="grow"><label>완주 보너스 (P)</label>' +
            '<input id="pj-bonus" type="number" min="0" placeholder="예: 200"></div>' +
          '<div class="grow"><label>마감 (선택 · 조기 완주 보너스 ↑)</label>' +
            '<input id="pj-deadline" type="date"></div>' +
        '</div>' +
        '<label>단계 (마일스톤)</label>' +
        '<div id="pj-rows"></div>' +
        '<button type="button" id="pj-addrow" class="ghost small" style="margin-top:6px">+ 단계 추가</button>' +
        '<button id="pj-save" style="margin-top:12px; width:100%">프로젝트 시작</button>' +
      '</div>';
  }

  function projList() {
    var S = PR.store.state;
    if (!S.projects.length) return '<div class="card"><div class="empty">진행 중인 프로젝트가 없어요</div></div>';
    return S.projects.map(function (pj) {
      var doneN = pj.milestones.filter(function (m) { return m.done; }).length;
      var ms = pj.milestones.map(function (m) {
        return '<div class="hist"><span>' + (m.done ? '✅' : '⬜') + ' ' + PR.esc(m.title) + ' <span class="pts">+' + m.pts + 'P</span></span>' +
          (pj.done ? '' : (m.done
            ? '<button class="gray small" data-msundo="' + pj.id + ':' + m.id + '">취소</button>'
            : '<button class="small" data-msdo="' + pj.id + ':' + m.id + '">완료</button>')) +
        '</div>';
      }).join('');
      return '<div class="card">' +
        '<div class="row"><div class="grow">' +
          '<div class="t" style="font-weight:700">' + (pj.done ? '🏆 ' : '🚩 ') + PR.esc(pj.title) + '</div>' +
          '<div class="sub">완주 보너스 ' + pj.bonusPts + 'P' + (pj.deadline ? ' · 마감 ' + pj.deadline : '') + (pj.done ? ' · ' + pj.doneDate + ' 완주' : '') + '</div>' +
        '</div>' +
        '<button class="danger small" data-pjdel="' + pj.id + '">삭제</button></div>' +
        PR.vh.progressBar(doneN, pj.milestones.length) +
        '<div style="margin-top:6px">' + ms + '</div>' +
      '</div>';
    }).join('');
  }

  function addMsRow(container) {
    var row = document.createElement('div');
    row.className = 'row msrow';
    row.style.marginTop = '6px';
    row.innerHTML = '<input class="ms-title grow" placeholder="단계 이름">' +
      '<input class="ms-pts" type="number" min="1" placeholder="P" style="width:70px">' +
      '<button type="button" class="danger small ms-del">✕</button>';
    row.querySelector('.ms-del').onclick = function () { row.remove(); };
    container.appendChild(row);
  }

  function submitProject() {
    var title = document.getElementById('pj-title').value.trim();
    if (!title) { PR.toast('프로젝트 이름을 입력해 주세요'); return; }
    var ms = [];
    document.querySelectorAll('#pj-rows .msrow').forEach(function (row) {
      var t = row.querySelector('.ms-title').value.trim();
      var pts = Number(row.querySelector('.ms-pts').value);
      if (t && pts > 0) ms.push({ id: PR.uid(), title: t, pts: Math.round(pts), done: false, date: '' });
    });
    if (!ms.length) { PR.toast('단계를 1개 이상 입력해 주세요'); return; }
    PR.actions.saveProject({
      id: PR.uid(), title: title,
      bonusPts: Math.max(0, Number(document.getElementById('pj-bonus').value) || 0),
      deadline: document.getElementById('pj-deadline').value || '',
      createdAt: PR.todayStr(), done: false, doneDate: '',
      milestones: ms
    });
  }

  PR.app.register('proj', {
    render: function () {
      return '<h2>프로젝트</h2>' + projForm() + projList();
    },

    bind: function (root) {
      root.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.id === 'pj-addrow') addMsRow(document.getElementById('pj-rows'));
        if (b.id === 'pj-save') submitProject();
        if (b.dataset.pjdel && confirm('이 프로젝트를 삭제할까요? (기록은 유지됩니다)')) PR.actions.deleteProject(b.dataset.pjdel);
        if (b.dataset.msdo) { var a = b.dataset.msdo.split(':'); PR.actions.completeMilestone(a[0], a[1]); }
        if (b.dataset.msundo && confirm('이 단계를 취소할까요? 받은 포인트가 회수됩니다.')) {
          var u = b.dataset.msundo.split(':'); PR.actions.uncompleteMilestone(u[0], u[1]);
        }
      };
      var rows = document.getElementById('pj-rows');
      if (rows && !rows.children.length) { addMsRow(rows); addMsRow(rows); addMsRow(rows); }
    }
  });
})(window.PR = window.PR || {});
