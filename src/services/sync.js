/* 데이터 동기화: JSON 내보내기/가져오기 + File System Access(PC 자동 저장) */
(function (PR) {
  'use strict';

  var fileHandle = null;
  var writeTimer = null;

  /* --- IndexedDB (파일 핸들 영속화) --- */
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('pr-db', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbSet(k, v) {
    return idb().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('kv', 'readwrite');
        t.objectStore('kv').put(v, k);
        t.oncomplete = res;
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function idbGet(k) {
    return idb().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('kv', 'readonly');
        var q = t.objectStore('kv').get(k);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }

  var sync = {
    supported: function () { return 'showSaveFilePicker' in window; },
    hasHandle: function () { return !!fileHandle; },

    exportData: function () {
      var blob = new Blob([JSON.stringify(PR.store.state, null, 1)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'planning_reward_data.json';
      a.click();
      URL.revokeObjectURL(a.href);
      PR.toast('내보내기 완료 — Syncthing 폴더에 넣으면 다른 기기로 전송돼요');
    },

    importFile: function (file) {
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var d = JSON.parse(rd.result);
          if (!d.v || d.v < 1 || d.v > 3) throw 0;
          if (d.lastMod < PR.store.state.lastMod &&
              !confirm('가져오는 데이터가 현재 데이터보다 오래됐어요. 그래도 덮어쓸까요?')) return;
          PR.actions.importState(d);
        } catch (e) {
          PR.toast('올바른 데이터 파일이 아니에요');
        }
      };
      rd.readAsText(file);
    },

    linkFile: function () {
      return window.showSaveFilePicker({
        suggestedName: 'planning_reward_data.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      }).then(function (h) {
        fileHandle = h;
        return idbSet('fh', h);
      }).then(function () {
        sync.write();
        PR.toast('파일 연결 완료 — 이제 자동 저장돼요');
        PR.bus.emit('change');
      }).catch(function () { /* 사용자 취소 */ });
    },

    /* 디바운스된 파일 쓰기 (store 저장 시 자동 호출) */
    write: function () {
      if (!fileHandle) return;
      clearTimeout(writeTimer);
      writeTimer = setTimeout(function () {
        fileHandle.createWritable().then(function (w) {
          return w.write(JSON.stringify(PR.store.state, null, 1)).then(function () { return w.close(); });
        }).catch(function () { fileHandle = null; });
      }, 400);
    },

    /* 시작 시: 연결된 파일이 더 최신이면 그 데이터로 복원 */
    restoreFile: function () {
      if (!sync.supported()) return Promise.resolve();
      return idbGet('fh').then(function (h) {
        if (!h) return;
        return h.queryPermission({ mode: 'readwrite' }).then(function (perm) {
          if (perm !== 'granted') return; // 재허용은 사용자가 '파일 연결' 버튼으로
          fileHandle = h;
          return h.getFile().then(function (f) { return f.text(); }).then(function (txt) {
            var d = JSON.parse(txt);
            if (d.v >= 1 && d.v <= 3 && d.lastMod > PR.store.state.lastMod) {
              PR.store.setRaw(d);
              PR.bus.emit('change');
            }
          });
        });
      }).catch(function () {});
    }
  };

  PR.bus.on('saved', function () { sync.write(); });
  PR.sync = sync;
})(window.PR = window.PR || {});
