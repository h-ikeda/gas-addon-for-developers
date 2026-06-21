'use strict';

const { loadGasScript } = require('./helpers/loadGasScript');
const { createGasEnv } = require('./helpers/mockGas');

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
