'use strict';

const { loadDialog } = require('./helpers/loadDialog');

// 保留中のタイマー（成功ハンドラの close は setTimeout(...,0) で発火する）を
// 消化するまで待つ。
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('submitName', () => {
  test('名前が空の場合はサーバへ送らずエラーを表示する', () => {
    const { window, runState } = loadDialog();
    window.document.getElementById('nameInput').value = '   ';

    window.submitName();

    expect(runState.lastArgs).toBeNull();
    expect(window.document.getElementById('status').innerText).toBe('名前を入力してください。');
  });

  test('成功時は前後の空白を除いた名前をサーバへ渡し、メッセージ表示後に閉じる', async () => {
    const { window, config, runState } = loadDialog();
    window.document.getElementById('nameInput').value = '  myRange  ';
    // サーバ側成功を模擬してメッセージを返す
    config.onSet = (name, state) => {
      state.successHandler('「myRange」を名前付き範囲に設定しました。');
    };

    window.submitName();
    await flush();

    expect(runState.lastArgs).toBe('myRange');
    expect(window.document.getElementById('status').innerText).toBe('「myRange」を名前付き範囲に設定しました。');
    // setTimeout は即時実行に差し替えてあるため close が呼ばれる
    expect(window.google.script.host.close).toHaveBeenCalledTimes(1);
  });

  test('サーバ失敗時はエラーメッセージを表示し、OK ボタンを再度有効化する', async () => {
    const { window, config } = loadDialog();
    window.document.getElementById('nameInput').value = 'dup';
    config.onSet = (name, state) => {
      state.failureHandler(new Error('名前付き範囲の設定に失敗しました'));
    };

    window.submitName();
    await flush();

    expect(window.document.getElementById('status').innerText).toBe('エラー: 名前付き範囲の設定に失敗しました');
    expect(window.document.getElementById('submitBtn').disabled).toBe(false);
  });
});
