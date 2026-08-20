/* 공통 유틸 + 이벤트 버스 + 토스트 */
(function (PR) {
  'use strict';

  PR.DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  PR.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  /* 하루 시작 시각 (기본 새벽 4시). 자정을 넘겨 끝낸 일이 "어제 것"으로 기록되게 한다. */
  PR.dayStart = function () {
    var h = PR.store && PR.store.state ? PR.store.state.dayStart : 4;
    return (h === undefined || h === null) ? 4 : h;
  };

  function fmt(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* 날짜 → 'YYYY-MM-DD'. 인자를 생략하면 "지금이 속한 하루"(하루 시작 시각 반영).
     인자를 주면 그 날짜를 그대로 포맷 — 날짜 순회 루프는 이 형태를 쓴다. */
  PR.todayStr = function (d) {
    if (d) return fmt(d);
    var n = new Date();
    var hs = PR.dayStart();
    if (hs > 0 && n.getHours() < hs) n.setDate(n.getDate() - 1); // 새벽은 아직 어제
    return fmt(n);
  };

  /* 논리적 '오늘'의 Date (정오 고정). 날짜를 거슬러 오르는 루프의 시작점으로 쓴다 —
     여기서 new Date()를 그대로 쓰면 새벽에 하루가 어긋난다. */
  PR.todayDate = function () {
    return new Date(PR.todayStr() + 'T12:00:00');
  };

  /* 지금이 하루 시작 시각 이전인지 (= 어제로 기록되는 새벽 시간대) */
  PR.inGraceHours = function () {
    var hs = PR.dayStart();
    return hs > 0 && new Date().getHours() < hs;
  };

  /* 해당 날짜가 속한 주의 월요일 (주간 쿼터 기준) */
  PR.weekKey = function (dateStr) {
    var d = new Date((dateStr || PR.todayStr()) + 'T12:00:00');
    var wd = (d.getDay() + 6) % 7; // 월=0
    d.setDate(d.getDate() - wd);
    return PR.todayStr(d);
  };

  /* a → b 일수 차 (b가 미래면 양수) */
  PR.daysBetween = function (a, b) {
    return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  };

  PR.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* 이벤트 버스: 컴포넌트 간 결합도를 낮추는 pub/sub */
  var subs = {};
  PR.bus = {
    on: function (ev, fn) { (subs[ev] = subs[ev] || []).push(fn); },
    emit: function (ev, data) { (subs[ev] || []).forEach(function (fn) { fn(data); }); }
  };

  var toastTimer = null;
  PR.toast = function (html) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.innerHTML = html;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  };
})(window.PR = window.PR || {});
