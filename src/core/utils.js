/* 공통 유틸 + 이벤트 버스 + 토스트 */
(function (PR) {
  'use strict';

  PR.DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  PR.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  PR.todayStr = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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
