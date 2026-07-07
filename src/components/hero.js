/* 상단 히어로: 포인트 잔액 / 스트릭 / 방어막 (레벨 시스템 제거됨) */
(function (PR) {
  'use strict';

  PR.app.register('hero', {
    render: function () {
      var S = PR.store.state;
      var st = PR.points.computeStreak(false);
      var today = PR.todayStr();
      var todayPts = S.logs.filter(function (l) { return l.date === today; })
        .reduce(function (a, l) { return a + l.pts; }, 0);
      return '' +
        '<div class="hero">' +
          '<div class="row"><div class="grow">' +
            '<div class="big">' + S.points.toLocaleString() + ' P</div>' +
            '<div class="lv">오늘 +' + todayPts.toLocaleString() + 'P · 누적 ' + S.earned.toLocaleString() + 'P</div>' +
          '</div><div style="font-size:34px">' + (st >= 7 ? '🔥' : st >= 3 ? '✨' : '🌱') + '</div></div>' +
          '<div class="badges">' +
            '<span class="badge">🔥 스트릭 ' + st + '일</span>' +
            '<span class="badge">🏆 최고 ' + S.bestStreak + '일</span>' +
            '<span class="badge">🛡 방어막 ' + (S.freezes || 0) + '</span>' +
          '</div>' +
        '</div>';
    }
  });
})(window.PR = window.PR || {});
