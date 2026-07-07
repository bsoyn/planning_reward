/* 보상 탭: 보상 등록/구매 + 구매 내역 */
(function (PR) {
  'use strict';

  PR.app.register('shop', {
    render: function () {
      var S = PR.store.state;
      var form = '<div class="card">' +
        '<div style="font-weight:700">🎁 보상 등록</div>' +
        '<label>보상 이름</label><input id="r-name" placeholder="예: 유튜브 30분, 치킨 시키기, 게임 1시간">' +
        '<label>가격 (P)</label><input id="r-cost" type="number" min="1" placeholder="100">' +
        '<button id="r-add" style="margin-top:10px; width:100%">등록</button>' +
      '</div>';

      var list = S.rewards.length ? S.rewards.map(function (r) {
        return '<div class="plan">' +
          '<div class="grow"><div class="t">' + PR.esc(r.name) + '</div><div class="sub pts">' + r.cost.toLocaleString() + ' P</div></div>' +
          '<button class="small" data-buy="' + r.id + '"' + (S.points < r.cost ? ' disabled' : '') + '>구매</button>' +
          '<button class="danger small" data-rdel="' + r.id + '">✕</button>' +
        '</div>';
      }).join('') : '<div class="empty">보상을 등록해 보세요!<br>동기부여가 되는 것일수록 좋아요 🎯</div>';

      var hist = S.purchases.slice().reverse().slice(0, 30).map(function (h) {
        return '<div class="hist"><span>🛍 ' + PR.esc(h.name) + '</span><span class="sub">' + h.date + ' · -' + h.cost + 'P</span></div>';
      }).join('');

      return '<h2>보상 상점</h2>' + form + '<div class="card">' + list + '</div>' +
        (hist ? '<div class="card"><details><summary>구매 내역 (' + S.purchases.length + ')</summary>' + hist + '</details></div>' : '');
    },

    bind: function (root) {
      root.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.id === 'r-add') {
          var name = document.getElementById('r-name').value.trim();
          var cost = Math.max(1, Number(document.getElementById('r-cost').value) || 0);
          if (!name || !cost) { PR.toast('이름과 가격을 입력해 주세요'); return; }
          PR.actions.addReward(name, cost);
        }
        if (b.dataset.buy) {
          var r = PR.store.state.rewards.find(function (x) { return x.id === b.dataset.buy; });
          if (r && confirm('"' + r.name + '" 을(를) ' + r.cost + 'P로 구매할까요?')) PR.actions.buyReward(b.dataset.buy);
        }
        if (b.dataset.rdel && confirm('이 보상을 삭제할까요?')) PR.actions.deleteReward(b.dataset.rdel);
      };
    }
  });
})(window.PR = window.PR || {});
