'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const srcDir = path.resolve(__dirname, '..', '..', 'src');

// GAS のテンプレート展開を再現する（loadDialog と同様）。
// <?!= include('X') ?> を X.html の中身に置換し、印字スクリプトレット <?= ... ?> は空文字に落とす。
function resolveTemplate(html) {
  return html
    .replace(/<\?!=\s*include\('([^']+)'\)\s*\?>/g, (_, name) =>
      fs.readFileSync(path.join(srcDir, name + '.html'), 'utf8')
    )
    .replace(/<\?=[\s\S]*?\?>/g, '');
}
const html = resolveTemplate(fs.readFileSync(path.join(srcDir, 'HighlightDialog.html'), 'utf8'));

// HighlightDialog.html を jsdom で読み込み、取り込んだ <script> を実行する。
function loadHighlightDialog() {
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  const win = dom.window;

  // テストから挙動を制御するための設定。
  const config = {
    onClear: null, // clearNamedRangeHighlight 呼び出し時のフック (runState) => void
  };

  // google.script.run: チェーンを再現し、clearNamedRangeHighlight 呼び出しを記録する。
  const runState = { successHandler: null, failureHandler: null, called: false };
  const run = {
    withSuccessHandler(fn) {
      runState.successHandler = fn;
      return run;
    },
    withFailureHandler(fn) {
      runState.failureHandler = fn;
      return run;
    },
    clearNamedRangeHighlight() {
      runState.called = true;
      if (config.onClear) {
        config.onClear(runState);
      }
    },
  };
  win.google = {
    script: {
      run,
      host: { close: jest.fn() },
    },
  };

  return { dom, window: win, config, runState };
}

module.exports = { loadHighlightDialog };
