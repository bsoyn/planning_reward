/* 앱 셸: 탭 라우팅 + 렌더 오케스트레이션.
   컴포넌트 계약: { render(): string, bind?(rootEl), onNavAway?() }
   PR.app.register(name, component)로 등록 */
(function (PR) {
  'use strict';

  PR.app = {
    tab: 'today',
    views: {},

    register: function (name, view) { this.views[name] = view; },

    render: function () {
      document.querySelectorAll('nav button').forEach(function (b) {
        b.classList.toggle('on', b.dataset.tab === PR.app.tab);
      });
      var hero = document.getElementById('hero');
      if (hero && this.views.hero) hero.innerHTML = this.views.hero.render();

      var root = document.getElementById('view');
      var view = this.views[this.tab];
      if (!root || !view) return;
      root.innerHTML = view.render();
      if (view.bind) view.bind(root);
    },

    setTab: function (name) {
      var prev = this.views[this.tab];
      if (prev && prev.onNavAway) prev.onNavAway();
      this.tab = name;
      this.render();
    },

    init: function () {
      var nav = document.querySelector('nav');
      if (nav) nav.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (b && b.dataset.tab) PR.app.setTab(b.dataset.tab);
      });
      PR.bus.on('change', function () { PR.app.render(); });
      /* 일일 정산: 놓친 예정일 방어막 소모/페널티 처리 (하루 1회) */
      var summary = PR.reconcile && PR.reconcile.run();
      this.render();
      if (summary) setTimeout(function () { PR.toast(summary); }, 400);
      PR.sync.restoreFile();
    }
  };
})(window.PR = window.PR || {});
