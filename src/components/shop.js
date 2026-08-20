/* 보상 탭: 내 사용권(티켓) → 보상 등록 → 보상 목록 → 사용 내역
   구매하면 사용권 1장이 발급되고, 실제로 누릴 때 '사용'을 눌러 소진한다.
   다회성 보상은 티켓이 여러 장 쌓이고, 1회성은 티켓이 있는 동안 잠긴다. */
(function (PR) {
  'use strict';

  /* 미사용 티켓을 보상별로 묶기 (같은 보상은 ×N) — 오래된 것부터 사용(FIFO) */
  function ticketGroups() {
    var open = PR.store.state.purchases.filter(function (p) { return !p.used; });
    var order = [];
    var by = {};
    open.forEach(function (t) {
      var k = t.rewardId || ('name:' + t.name);
      if (!by[k]) { by[k] = { key: k, name: t.name, cost: t.cost, items: [] }; order.push(k); }
      by[k].items.push(t);
    });
    return order.map(function (k) { return by[k]; });
  }

  function ticketCard() {
    var groups = ticketGroups();
    if (!groups.length) return '';
    var n = groups.reduce(function (a, g) { return a + g.items.length; }, 0);
    var rows = groups.map(function (g) {
      var first = g.items[0]; // 가장 먼저 산 티켓부터 사용
      return '<div class="plan">' +
        '<div class="grow"><div class="t">🎟 ' + PR.esc(g.name) +
          (g.items.length > 1 ? ' <span class="chip d1">×' + g.items.length + '</span>' : '') + '</div>' +
          '<div class="sub">' + first.date + ' 구매 · ' + g.cost.toLocaleString() + 'P</div></div>' +
        '<button class="small" data-use="' + first.id + '">사용</button>' +
        '<button class="ghost small" data-refund="' + first.id + '">환불</button>' +
      '</div>';
    }).join('');
    return '<div class="card">' +
      '<div style="font-weight:700">🎟 내 사용권 (' + n + '장)</div>' +
      '<div class="sub" style="margin-top:2px">사 두고 아껴 뒀다가, 누릴 때 눌러서 사용하세요</div>' +
      '<div style="margin-top:8px">' + rows + '</div>' +
    '</div>';
  }

  function formCard() {
    return '<div class="card">' +
      '<div style="font-weight:700">🎁 보상 등록</div>' +
      '<label>보상 이름</label><input id="r-name" placeholder="예: 유튜브 30분, 치킨 시키기, 게임 1시간">' +
      '<label>가격 (P)</label><input id="r-cost" type="number" min="1" placeholder="100">' +
      '<label>구매 방식</label>' +
      '<div class="row">' +
        '<button type="button" class="grow" id="r-many">🔁 여러 번</button>' +
        '<button type="button" class="grow gray" id="r-once">1️⃣ 한 번만</button>' +
      '</div>' +
      '<div class="sub" style="margin-top:4px">여러 번: 살 때마다 사용권이 쌓여요 · 한 번만: 딱 한 장만 살 수 있어요</div>' +
      '<button id="r-add" style="margin-top:10px; width:100%">등록</button>' +
    '</div>';
  }

  function listCard() {
    var S = PR.store.state;
    if (!S.rewards.length) {
      return '<div class="card"><div class="empty">보상을 등록해 보세요!<br>동기부여가 되는 것일수록 좋아요 🎯</div></div>';
    }
    var rows = S.rewards.map(function (r) {
      var sold = PR.actions.isSoldOut(r);
      var kind = r.once
        ? '<span class="chip" style="background:#fdf0e8;color:#d97706">한 번만</span>'
        : '<span class="chip" style="background:#f0f0f5;color:#999">여러 번</span>';
      var held = S.purchases.filter(function (x) { return x.rewardId === r.id && !x.used; }).length;
      return '<div class="plan ' + (sold ? 'done' : '') + '">' +
        '<div class="grow"><div class="t">' + PR.esc(r.name) + ' ' + kind +
          (held ? ' <span class="chip d1">사용권 ' + held + '장</span>' : '') + '</div>' +
          '<div class="sub pts">' + r.cost.toLocaleString() + ' P</div></div>' +
        (sold
          ? '<button class="gray small" disabled>구매함</button>'
          : '<button class="small" data-buy="' + r.id + '"' + (S.points < r.cost ? ' disabled' : '') + '>구매</button>') +
        '<button class="danger small" data-rdel="' + r.id + '">✕</button>' +
      '</div>';
    }).join('');
    return '<div class="card">' + rows + '</div>';
  }

  function historyCard() {
    var used = PR.store.state.purchases.filter(function (p) { return p.used; });
    if (!used.length) return '';
    var rows = used.slice().reverse().slice(0, 30).map(function (h) {
      return '<div class="hist"><span>🛍 ' + PR.esc(h.name) + '</span>' +
        '<span class="sub">' + (h.usedAt || h.date) + ' 사용 · -' + h.cost + 'P ' +
        '<button class="ghost small" data-unuse="' + h.id + '">되돌리기</button></span></div>';
    }).join('');
    return '<div class="card"><details><summary>사용 내역 (' + used.length + ')</summary>' + rows + '</details></div>';
  }

  PR.app.register('shop', {
    render: function () {
      return '<h2>보상 상점</h2>' + ticketCard() + formCard() + listCard() + historyCard();
    },

    bind: function (root) {
      root.onclick = function (e) {
        var b = e.target.closest('button');
        if (!b) return;

        /* 구매 방식 토글 (선택된 쪽이 진하게) */
        if (b.id === 'r-many' || b.id === 'r-once') {
          var once = b.id === 'r-once';
          document.getElementById('r-many').className = 'grow ' + (once ? 'gray' : '');
          document.getElementById('r-once').className = 'grow ' + (once ? '' : 'gray');
          return;
        }
        if (b.id === 'r-add') {
          var name = document.getElementById('r-name').value.trim();
          var cost = Math.max(1, Number(document.getElementById('r-cost').value) || 0);
          if (!name || !cost) { PR.toast('이름과 가격을 입력해 주세요'); return; }
          var isOnce = !document.getElementById('r-once').classList.contains('gray');
          PR.actions.addReward(name, cost, isOnce);
          return;
        }
        if (b.dataset.buy) {
          var r = PR.store.state.rewards.find(function (x) { return x.id === b.dataset.buy; });
          if (r && confirm('"' + r.name + '" 을(를) ' + r.cost + 'P로 구매할까요?\n사용권 1장이 발급돼요.')) {
            PR.actions.buyReward(b.dataset.buy);
          }
          return;
        }
        if (b.dataset.use) {
          var t = PR.store.state.purchases.find(function (x) { return x.id === b.dataset.use; });
          if (t && confirm('"' + t.name + '" 사용권을 지금 쓸까요?')) PR.actions.useTicket(b.dataset.use);
          return;
        }
        if (b.dataset.refund && confirm('아직 안 쓴 사용권을 환불할까요? 포인트를 돌려받아요.')) {
          PR.actions.refundTicket(b.dataset.refund);
          return;
        }
        if (b.dataset.unuse && confirm('사용을 취소하고 사용권으로 되돌릴까요?')) {
          PR.actions.unuseTicket(b.dataset.unuse);
          return;
        }
        if (b.dataset.rdel && confirm('이 보상을 삭제할까요? (이미 산 사용권은 그대로 남아요)')) {
          PR.actions.deleteReward(b.dataset.rdel);
        }
      };
    }
  });
})(window.PR = window.PR || {});
