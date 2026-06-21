'use strict';

// コード.js が利用する Google Apps Script のグローバル API を再現する軽量モック群。
// jest.fn() で各呼び出しを記録し、テストから引数・呼び出し回数を検証できるようにする。

// 1つの RangeElement（選択範囲の構成要素）を作る。
// getText を持つテキスト要素を内包し、部分選択／全体選択を切り替えられる。
function makeRangeElement(text, partial, startOffset, endOffsetInclusive) {
  const element = {
    getText: jest.fn(() => text),
  };
  return {
    getElement: jest.fn(() => element),
    isPartial: jest.fn(() => !!partial),
    getStartOffset: jest.fn(() => (startOffset == null ? 0 : startOffset)),
    getEndOffsetInclusive: jest.fn(() =>
      endOffsetInclusive == null ? text.length - 1 : endOffsetInclusive
    ),
    _element: element,
  };
}

// 選択範囲（Selection）のモックを作る。getRangeElements で構成要素を返す。
function makeSelection(text) {
  const rangeElement = makeRangeElement(text, false);
  return {
    getRangeElements: jest.fn(() => [rangeElement]),
    _rangeElement: rangeElement,
  };
}

/**
 * GAS 環境一式を生成する。
 *
 * options:
 *   hasSelection  選択範囲の有無（false で getSelection() が null を返す）
 *   selectedText  選択中のテキスト（extractSelectedText が返す想定値）
 */
function createGasEnv(options) {
  const opts = options || {};
  const selectedText = opts.selectedText == null ? '選択テキスト' : opts.selectedText;
  const selection = opts.hasSelection === false ? null : makeSelection(selectedText);

  const doc = {
    getSelection: jest.fn(() => selection),
    addNamedRange: jest.fn((name, range) => ({ _name: name, _range: range })),
  };

  // UI / メニュー（onOpen / showNamedRangeDialog 用）。チェーン呼び出しを再現する。
  const menu = {
    addItem: jest.fn(() => menu),
    addToUi: jest.fn(() => menu),
  };
  const ui = {
    createAddonMenu: jest.fn(() => menu),
    showModalDialog: jest.fn(),
    alert: jest.fn(),
  };

  const DocumentApp = {
    getActiveDocument: jest.fn(() => doc),
    getUi: jest.fn(() => ui),
  };

  // HtmlService（showNamedRangeDialog / include 用）。setter はチェーンのため自身を返す。
  const htmlOutput = {
    setWidth: jest.fn(() => htmlOutput),
    setHeight: jest.fn(() => htmlOutput),
    setTitle: jest.fn(() => htmlOutput),
    // include() が呼ぶ getContent（取り込まれる HTML の中身）
    getContent: jest.fn(() => '<included-content>'),
  };
  // createTemplateFromFile('Dialog').evaluate() で htmlOutput を返すテンプレート。
  // showNamedRangeDialog は template.defaultName に初期値を代入するため、プレーンオブジェクトにしておく。
  const template = {
    evaluate: jest.fn(() => htmlOutput),
  };
  const HtmlService = {
    createTemplateFromFile: jest.fn(() => template),
    createHtmlOutputFromFile: jest.fn(() => htmlOutput),
  };

  const globals = {
    DocumentApp,
    HtmlService,
  };

  return {
    globals,
    // 検証用に内部参照を公開する
    doc,
    selection,
    menu,
    ui,
    htmlOutput,
    template,
    selectedText,
  };
}

module.exports = { createGasEnv, makeSelection, makeRangeElement };
