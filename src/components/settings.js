/* 설정 탭: 보상 규칙 / 동기화 / 데이터 관리 */
(function (PR) {
  'use strict';

  PR.app.register('setting', {
    render: function () {
      var S = PR.store.state;
      var fsa = PR.sync.supported();
      return '<h2>설정 · 데이터</h2>' +
        '<div class="card">' +
          '<div style="font-weight:700; margin-bottom:8px">📱↔💻 기기 간 동기화</div>' +
          '<div class="sub" style="line-height:1.7; margin-bottom:10px">' +
            '데이터는 이 브라우저에 자동 저장돼요.<br>' +
            '다른 기기와 맞추려면 <b>내보내기 → (Syncthing/클라우드로 파일 전달) → 가져오기</b>를 사용하세요.<br>' +
            (fsa
              ? 'PC에서는 아래 <b>파일 연결</b>을 하면 변경될 때마다 그 파일에 자동 저장됩니다. Syncthing 폴더 안의 파일을 연결하면 폰으로 자동 전송돼요.'
              : '이 브라우저는 파일 자동 저장을 지원하지 않아 수동 내보내기/가져오기를 사용하세요.') +
          '</div>' +
          '<div class="row" style="flex-wrap:wrap">' +
            '<button id="s-export" class="grow">📤 내보내기</button>' +
            '<button id="s-import" class="ghost grow">📥 가져오기</button>' +
            (fsa ? '<button id="s-link" class="ghost grow">🔗 파일 연결' + (PR.sync.hasHandle() ? ' 됨 ✓' : '') + '</button>' : '') +
          '</div>' +
          '<input type="file" id="s-file" accept=".json" class="hidden">' +
        '</div>' +
        '<div class="card">' +
          '<div style="font-weight:700; margin-bottom:8px">🎯 보상 규칙</div>' +
          '<div class="row" style="align-items:center; justify-content:space-between">' +
            '<div class="sub" style="line-height:1.6; flex:1">예정된 계획을 놓친 날 소액 차감<br>' +
              '<span style="opacity:.7">방어막이 있으면 차감 대신 방어막이 쓰여요</span></div>' +
            '<button id="s-penalty" class="' + (S.penaltyOn ? '' : 'ghost') + ' small">' + (S.penaltyOn ? '켜짐' : '꺼짐') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div style="font-weight:700; margin-bottom:8px">📲 폰에서 앱처럼 쓰기</div>' +
          '<div class="sub" style="line-height:1.7">이 HTML 파일을 폰으로 보내 브라우저로 연 뒤, 메뉴에서 <b>"홈 화면에 추가"</b>를 누르면 앱 아이콘처럼 쓸 수 있어요.</div>' +
        '</div>' +
        '<div class="card">' +
          '<button id="s-reset" class="danger" style="width:100%">전체 데이터 초기화</button>' +
        '</div>' +
        '<div class="sub" style="text-align:center; margin-top:6px">마지막 저장: ' + (S.lastMod ? new Date(S.lastMod).toLocaleString('ko-KR') : '없음') + '</div>';
    },

    bind: function (root) {
      root.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.id === 's-penalty') PR.actions.setPenalty(!PR.store.state.penaltyOn);
        if (b.id === 's-export') PR.sync.exportData();
        if (b.id === 's-import') document.getElementById('s-file').click();
        if (b.id === 's-link') PR.sync.linkFile();
        if (b.id === 's-reset' && confirm('정말 모든 데이터를 삭제할까요?') && confirm('되돌릴 수 없어요. 진행할까요?')) PR.actions.resetAll();
      };
      var fi = document.getElementById('s-file');
      if (fi) fi.onchange = function (e) {
        var f = e.target.files[0];
        if (f) PR.sync.importFile(f);
        e.target.value = '';
      };
    }
  });
})(window.PR = window.PR || {});
