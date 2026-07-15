/* 더보기 탭: [통계 | 설정] — 기존 stats/setting 뷰에 위임 */
(function (PR) {
  'use strict';

  var seg = 'stats';

  PR.app.register('more', {
    render: function () {
      var segBtns = '<div class="row" style="margin-bottom:10px; margin-top:14px">' +
        '<button class="grow small ' + (seg === 'stats' ? '' : 'gray') + '" data-mseg="stats">📊 통계</button>' +
        '<button class="grow small ' + (seg === 'setting' ? '' : 'gray') + '" data-mseg="setting">⚙️ 설정</button></div>';
      return segBtns + PR.app.views[seg].render();
    },

    bind: function (root) {
      var v = PR.app.views[seg];
      if (v && v.bind) v.bind(root);
      var sub = root.onclick;
      root.onclick = function (e) {
        var b = e.target.closest('button');
        if (b && b.dataset.mseg) { seg = b.dataset.mseg; PR.app.render(); return; }
        if (sub) sub(e);
      };
    }
  });
})(window.PR = window.PR || {});
