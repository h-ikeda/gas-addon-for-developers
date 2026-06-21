'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const projectRoot = path.resolve(__dirname, '..', '..');

// GAS のテンプレート展開を再現する。
// 1) <?!= include('X') ?> を X.html の中身に置き換える。
// 2) サーバ側で値が差し込まれる印字スクリプトレット <?= ... ?> はテスト用に空文字へ落とす。
// 内容は不変なので、モジュール読み込み時に一度だけ解決してキャッシュする。
function resolveTemplate(html) {
  return html
    .replace(/<\?!=\s*include\('([^']+)'\)\s*\?>/g, (_, name) =>
      fs.readFileSync(path.join(projectRoot, name + '.html'), 'utf8')
    )
    .replace(/<\?=[\s\S]*?\?>/g, '');
}
const html = resolveTemplate(fs.readFileSync(path.join(projectRoot, 'Dialog.html'), 'utf8'));

// Dialog.html を jsdom で読み込み、取り込んだ <script> を実行する。
// ブラウザ依存 API（google.script.run）はソースを変更せずにテストするため、
// window 上のグローバルを差し替えて制御する。
function loadDialog() {
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  const win = dom.window;

  // テストから挙動を制御するための設定。
  const config = {
    onSet: null, // setNamedRange 呼び出し時のフック (name, runState) => void
  };

  // google.script.run: チェーンを再現し、setNamedRange 受信を記録する。
  const runState = { successHandler: null, failureHandler: null, lastArgs: null };
  const run = {
    withSuccessHandler(fn) {
      runState.successHandler = fn;
      return run;
    },
    withFailureHandler(fn) {
      runState.failureHandler = fn;
      return run;
    },
    setNamedRange(name) {
      runState.lastArgs = name;
      if (config.onSet) {
        config.onSet(name, runState);
      }
    },
  };
  win.google = {
    script: {
      run,
      host: { close: jest.fn() },
    },
  };

  // 成功ハンドラ内の setTimeout(close, 1000) は遅延だけスキップし、非同期の実行順序は
  // 保ったまま検証できるよう、Node の setTimeout(fn, 0) に委譲する。
  // テスト側は flush()（setTimeout 0 待ち）で完了を待てる。
  win.setTimeout = (fn) => setTimeout(fn, 0);

  return { dom, window: win, config, runState };
}

module.exports = { loadDialog };
