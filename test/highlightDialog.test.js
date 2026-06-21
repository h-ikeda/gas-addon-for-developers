'use strict';

const { loadHighlightDialog } = require('./helpers/loadHighlightDialog');

describe('stopHighlight', () => {
  test('「閉じる」でサーバの clearNamedRangeHighlight を呼び、成功時にダイアログを閉じる', () => {
    const { window, config, runState } = loadHighlightDialog();
    config.onClear = (state) => {
      state.successHandler();
    };

    window.stopHighlight();

    expect(runState.called).toBe(true);
    expect(window.google.script.host.close).toHaveBeenCalledTimes(1);
  });

  test('サーバ失敗時はエラーメッセージを表示し、閉じるボタンを再度有効化する', () => {
    const { window, config } = loadHighlightDialog();
    config.onClear = (state) => {
      state.failureHandler(new Error('元に戻せませんでした'));
    };

    window.stopHighlight();

    expect(window.document.getElementById('status').innerText).toBe('エラー: 元に戻せませんでした');
    expect(window.document.getElementById('closeBtn').disabled).toBe(false);
    expect(window.google.script.host.close).not.toHaveBeenCalled();
  });
});
