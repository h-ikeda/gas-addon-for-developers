'use strict';

const { loadGasScript } = require('./helpers/loadGasScript');
const {
  createGasEnv,
  makeTextElement,
  makeNamedRangeElement,
  makeNamedRange,
} = require('./helpers/mockGas');

// テスト対象の Apps Script 関数を、モック GAS 環境を差し込んで読み込むヘルパー。
function load(envOptions) {
  const env = createGasEnv(envOptions);
  const ctx = loadGasScript(env.globals);
  return { env, ctx };
}

describe('onInstall / onOpen', () => {
  test('onOpen はアドオンメニューに「選択範囲を名前付き範囲に設定」を登録する', () => {
    const { env, ctx } = load();

    ctx.onOpen({});

    expect(env.ui.createAddonMenu).toHaveBeenCalledTimes(1);
    expect(env.menu.addItem).toHaveBeenCalledWith('選択範囲を名前付き範囲に設定', 'showNamedRangeDialog');
    expect(env.menu.addItem).toHaveBeenCalledWith('名前付き範囲をハイライト', 'highlightNamedRanges');
    expect(env.menu.addToUi).toHaveBeenCalledTimes(1);
  });

  test('onInstall は onOpen と同じメニュー登録を行う', () => {
    const { env, ctx } = load();

    ctx.onInstall({});

    expect(env.ui.createAddonMenu).toHaveBeenCalledTimes(1);
    expect(env.menu.addItem).toHaveBeenCalledWith('選択範囲を名前付き範囲に設定', 'showNamedRangeDialog');
    expect(env.menu.addToUi).toHaveBeenCalledTimes(1);
  });
});

describe('include', () => {
  test('指定した HTML ファイルの中身（getContent）を返す', () => {
    const { env, ctx } = load();

    const content = ctx.include('DialogJavaScript');

    expect(env.globals.HtmlService.createHtmlOutputFromFile).toHaveBeenCalledWith('DialogJavaScript');
    expect(content).toBe('<included-content>');
  });
});

describe('showNamedRangeDialog', () => {
  test('選択が無い場合はアラートを表示し、ダイアログは開かない', () => {
    const { env, ctx } = load({ hasSelection: false });

    ctx.showNamedRangeDialog();

    expect(env.ui.alert).toHaveBeenCalledTimes(1);
    expect(env.ui.showModalDialog).not.toHaveBeenCalled();
  });

  test('選択テキストを初期値に設定し、サイズ・タイトルを指定して表示する', () => {
    const { env, ctx } = load({ selectedText: '見出し' });

    ctx.showNamedRangeDialog();

    expect(env.globals.HtmlService.createTemplateFromFile).toHaveBeenCalledWith('Dialog');
    // 選択テキストがテンプレートの初期値として渡される
    expect(env.template.defaultName).toBe('見出し');
    expect(env.htmlOutput.setWidth).toHaveBeenCalledWith(400);
    expect(env.htmlOutput.setHeight).toHaveBeenCalledWith(160);
    expect(env.htmlOutput.setTitle).toHaveBeenCalledWith('名前付き範囲の設定');
    expect(env.ui.showModalDialog).toHaveBeenCalledWith(env.htmlOutput, '名前付き範囲の設定');
  });
});

describe('setNamedRange', () => {
  test('名前が空（空白のみ）の場合はエラーを投げる', () => {
    const { ctx } = load();

    expect(() => ctx.setNamedRange('   ')).toThrow('名前を入力してください。');
  });

  test('選択が無い場合はエラーを投げる', () => {
    const { ctx } = load({ hasSelection: false });

    expect(() => ctx.setNamedRange('foo'))
      .toThrow('選択範囲が見つかりません。テキストを選択してから再実行してください。');
  });

  test('現在の選択範囲を名前付き範囲として登録し、メッセージを返す', () => {
    const { env, ctx } = load();

    const result = ctx.setNamedRange('myRange');

    expect(env.doc.addNamedRange).toHaveBeenCalledWith('myRange', env.selection);
    expect(result).toBe('「myRange」を名前付き範囲に設定しました。');
  });

  test('名前の前後の空白は取り除いて登録する', () => {
    const { env, ctx } = load();

    const result = ctx.setNamedRange('  spaced  ');

    expect(env.doc.addNamedRange).toHaveBeenCalledWith('spaced', env.selection);
    expect(result).toBe('「spaced」を名前付き範囲に設定しました。');
  });
});

// テキスト要素を1つだけ含む名前付き範囲（要素全体を対象）を作るヘルパー。
function namedRangeWith(text, opts) {
  const element = makeTextElement(text, opts);
  const namedRange = makeNamedRange([makeNamedRangeElement(element, false)]);
  return { namedRange, element };
}

describe('highlightNamedRanges', () => {
  test('名前付き範囲が無い場合はアラートを表示し、ダイアログは開かない', () => {
    const { env, ctx } = load({ namedRanges: [] });

    ctx.highlightNamedRanges();

    expect(env.ui.alert).toHaveBeenCalledTimes(1);
    expect(env.ui.showModelessDialog).not.toHaveBeenCalled();
  });

  test('各範囲に背景色を付け、スナップショットを保存し、モードレスダイアログを表示する', () => {
    const { namedRange, element } = namedRangeWith('Hello');
    const { env, ctx } = load({ namedRanges: [namedRange] });

    ctx.highlightNamedRanges();

    // テキスト全体（0〜4）にハイライト色が設定される
    expect(element.setBackgroundColor).toHaveBeenCalledWith(0, 4, '#fff475');

    // 元の背景色（ここでは null）がスナップショットとして保存される
    const raw = env.propsStore.namedRangeHighlightSnapshot;
    expect(raw).toBeDefined();
    expect(JSON.parse(raw)).toEqual([
      { elements: [{ runs: [{ start: 0, end: 4, color: null }] }] },
    ]);

    // 非ブロッキングのモードレスダイアログを開く
    expect(env.globals.HtmlService.createTemplateFromFile).toHaveBeenCalledWith('HighlightDialog');
    expect(env.htmlOutput.setTitle).toHaveBeenCalledWith('名前付き範囲のハイライト');
    expect(env.ui.showModelessDialog).toHaveBeenCalledWith(env.htmlOutput, '名前付き範囲のハイライト');
  });

  test('既にハイライト中なら、先に元へ戻してから貼り直す（ハイライト色を元色として記録しない）', () => {
    // 直前のハイライトで全体を黄色にしていた、という状態のスナップショットを用意する
    const previous = JSON.stringify([
      { elements: [{ runs: [{ start: 0, end: 4, color: '#ff0000' }] }] },
    ]);
    const { namedRange, element } = namedRangeWith('Hello', {
      backgroundColorAt: () => '#fff475', // 現在はハイライト色で塗られている
    });
    const { ctx } = load({
      namedRanges: [namedRange],
      documentProperties: { namedRangeHighlightSnapshot: previous },
    });

    ctx.highlightNamedRanges();

    // 最初に元色（赤）へ復元し、その後あらためてハイライト色を適用している
    expect(element.setBackgroundColor).toHaveBeenNthCalledWith(1, 0, 4, '#ff0000');
    expect(element.setBackgroundColor).toHaveBeenNthCalledWith(2, 0, 4, '#fff475');
  });
});

describe('clearNamedRangeHighlight', () => {
  test('スナップショットが無ければ何もしない', () => {
    const { namedRange, element } = namedRangeWith('Hello');
    const { env, ctx } = load({ namedRanges: [namedRange] });

    ctx.clearNamedRangeHighlight();

    expect(element.setBackgroundColor).not.toHaveBeenCalled();
    expect(env.documentProperties.deleteProperty).not.toHaveBeenCalled();
  });

  test('保存した元の背景色へ戻し、スナップショットを削除する', () => {
    const snapshot = JSON.stringify([
      {
        elements: [
          {
            runs: [
              { start: 0, end: 2, color: '#ff0000' },
              { start: 3, end: 4, color: null },
            ],
          },
        ],
      },
    ]);
    const { namedRange, element } = namedRangeWith('Hello');
    const { env, ctx } = load({
      namedRanges: [namedRange],
      documentProperties: { namedRangeHighlightSnapshot: snapshot },
    });

    ctx.clearNamedRangeHighlight();

    expect(element.setBackgroundColor).toHaveBeenCalledWith(0, 2, '#ff0000');
    expect(element.setBackgroundColor).toHaveBeenCalledWith(3, 4, null);
    expect(env.documentProperties.deleteProperty).toHaveBeenCalledWith('namedRangeHighlightSnapshot');
    expect(env.propsStore.namedRangeHighlightSnapshot).toBeUndefined();
  });
});
