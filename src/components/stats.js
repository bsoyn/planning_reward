/* 통계 탭: 7일 그래프 + 30일 달성률 + 요약 */
(function (PR) {
  'use strict';

  PR.app.register('stats', {
    render: function () {
      var S = PR.store.state;

      /* 최근 7일 포인트 (마일스톤/완주 보너스/페널티 포함 = 순증감) */
      var days = [];
      for (var i = 6; i >= 0; i--) {
        var d = new Date(); d.setDate(d.getDate() - i);
        days.push(PR.todayStr(d));
      }
      var daily = days.map(function (ds) {
        return S.logs.filter(function (l) { return l.date === ds; })
          .reduce(function (a, l) { return a + l.pts; }, 0);
      });
      var max = Math.max.apply(null, daily.concat([10]));
      var W = 480, H = 170, bw = W / 7;
      var bars = daily.map(function (v, i) {
        var h = v / max * 120;
        var dd = new Date(days[i] + 'T12:00:00');
        return '<rect x="' + (i * bw + 10) + '" y="' + (140 - h) + '" width="' + (bw - 20) + '" height="' + Math.max(h, 2) + '" rx="6" fill="' + (i === 6 ? 'var(--accent)' : '#c9cbee') + '"/>' +
          '<text x="' + (i * bw + bw / 2) + '" y="' + (132 - h) + '" text-anchor="middle" font-size="11" fill="#888">' + (v || '') + '</text>' +
          '<text x="' + (i * bw + bw / 2) + '" y="160" text-anchor="middle" font-size="11" fill="#aaa">' + (dd.getMonth() + 1) + '/' + dd.getDate() + '</text>';
      }).join('');

      /* 30일 달성률 — 완전 달성만 인정 */
      var sched = 0, done = 0;
      /* 요일 고정(습관/반복): 일 단위 */
      for (var j = 0; j < 30; j++) {
        var d2 = new Date(); d2.setDate(d2.getDate() - j);
        var ds2 = PR.todayStr(d2);
        S.plans.forEach(function (p) {
          if ((p.kind !== 'habit' && p.kind !== 'routine') || (p.freq && p.freq.type === 'weekly')) return;
          if (!PR.sched.isScheduledOn(p, ds2)) return;
          sched++;
          if (S.logs.some(function (l) { return l.planId === p.id && l.date === ds2 && l.full; })) done++;
        });
      }
      /* 주 n회(습관/반복): 주 단위 (최근 4주) */
      for (var w = 0; w < 4; w++) {
        var wd = new Date(); wd.setDate(wd.getDate() - w * 7);
        var wk = PR.weekKey(PR.todayStr(wd));
        S.plans.forEach(function (p) {
          if ((p.kind !== 'habit' && p.kind !== 'routine') || !p.freq || p.freq.type !== 'weekly') return;
          sched += p.freq.n;
          done += Math.min(PR.sched.weekFullCount(p.id, wk), p.freq.n);
        });
      }
      var rate = sched ? Math.round(done / sched * 100) : 0;
      var weekPts = daily.reduce(function (a, b) { return a + b; }, 0);
      var spent = S.purchases.reduce(function (a, p) { return a + p.cost; }, 0);
      var pjDone = S.projects.filter(function (p) { return p.done; }).length;
      var completions = S.logs.filter(function (l) { return !l.penalty; }).length; // 페널티 로그 제외
      var docked = S.logs.filter(function (l) { return l.penalty; }).reduce(function (a, l) { return a - l.pts; }, 0);

      return '<h2>통계</h2>' +
        '<div class="stat3">' +
          '<div class="card"><div class="n">' + rate + '%</div><div class="sub">30일 달성률</div></div>' +
          '<div class="card"><div class="n pts">' + weekPts + '</div><div class="sub">7일 획득 P</div></div>' +
          '<div class="card"><div class="n">' + completions + '</div><div class="sub">총 완료 횟수</div></div>' +
        '</div>' +
        '<div class="card" style="margin-top:10px">' +
          '<div style="font-weight:700; margin-bottom:6px">최근 7일 획득 포인트</div>' +
          '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%">' + bars + '</svg>' +
        '</div>' +
        '<div class="card">' +
          '<div class="hist"><span>🔥 현재 스트릭</span><b>' + PR.points.computeStreak(false) + '일</b></div>' +
          '<div class="hist"><span>🏆 최고 스트릭</span><b>' + S.bestStreak + '일</b></div>' +
          '<div class="hist"><span>🛡 방어막</span><b>' + (S.freezes || 0) + '개</b></div>' +
          '<div class="hist"><span>🚩 완주한 프로젝트</span><b>' + pjDone + '개</b></div>' +
          '<div class="hist"><span>💰 누적 획득</span><b>' + S.earned.toLocaleString() + 'P</b></div>' +
          '<div class="hist"><span>🛍 보상에 사용</span><b>' + spent.toLocaleString() + 'P</b></div>' +
          (docked ? '<div class="hist"><span>🥶 놓쳐서 차감</span><b>' + docked.toLocaleString() + 'P</b></div>' : '') +
        '</div>';
    }
  });
})(window.PR = window.PR || {});
