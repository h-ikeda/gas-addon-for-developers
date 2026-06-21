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

// 背景色ハイライト用のテキスト要素モック。editAsText は自身を返し、
// getTextAttributeIndices / getBackgroundColor / setBackgroundColor を備える。
//   opts.attributeIndices   getTextAttributeIndices() が返す書式変更位置
//   opts.backgroundColorAt  offset を受け取り背景色を返す関数（既定は常に null）
function makeTextElement(text, opts) {
  const o = opts || {};
  const element = {
    getText: jest.fn(() => text),
    editAsText: jest.fn(() => element),
    getTextAttributeIndices: jest.fn(() => o.attributeIndices || []),
    getBackgroundColor: jest.fn((offset) =>
      o.backgroundColorAt ? o.backgroundColorAt(offset) : null
    ),
    setBackgroundColor: jest.fn(),
  };
  return element;
}

// 名前付き範囲を構成する RangeElement のモック。element は makeTextElement 等。
function makeNamedRangeElement(element, partial, startOffset, endOffsetInclusive) {
  return {
    getElement: jest.fn(() => element),
    isPartial: jest.fn(() => !!partial),
    getStartOffset: jest.fn(() => startOffset || 0),
    getEndOffsetInclusive: jest.fn(() => endOffsetInclusive),
  };
}

// 名前付き範囲（NamedRange）のモック。getRange().getRangeElements() で構成要素を返す。
function makeNamedRange(rangeElements) {
  const range = { getRangeElements: jest.fn(() => rangeElements) };
  return {
    getRange: jest.fn(() => range),
    _range: range,
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
  const namedRanges = opts.namedRanges || [];

  const doc = {
    getSelection: jest.fn(() => selection),
    addNamedRange: jest.fn((name, range) => ({ _name: name, _range: range })),
    getNamedRanges: jest.fn(() => namedRanges),
  };

  // UI / メニュー（onOpen / showNamedRangeDialog 用）。チェーン呼び出しを再現する。
  const menu = {
    addItem: jest.fn(() => menu),
    addToUi: jest.fn(() => menu),
  };
  const ui = {
    createAddonMenu: jest.fn(() => menu),
    showModalDialog: jest.fn(),
    showModelessDialog: jest.fn(),
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

  // PropertiesService（ハイライトのスナップショット永続化用）。内部ストアを介して
  // get / set / delete を再現し、別実行をまたいだ保存・復元をテストできるようにする。
  const propsStore = opts.documentProperties || {};
  const documentProperties = {
    getProperty: jest.fn((key) => (key in propsStore ? propsStore[key] : null)),
    setProperty: jest.fn((key, value) => {
      propsStore[key] = value;
      return documentProperties;
    }),
    deleteProperty: jest.fn((key) => {
      delete propsStore[key];
      return documentProperties;
    }),
  };
  const PropertiesService = {
    getDocumentProperties: jest.fn(() => documentProperties),
  };

  const globals = {
    DocumentApp,
    HtmlService,
    PropertiesService,
  };

  return {
    globals,
    // 検証用に内部参照を公開する
    doc,
    selection,
    namedRanges,
    menu,
    ui,
    htmlOutput,
    template,
    selectedText,
    documentProperties,
    propsStore,
  };
}

module.exports = {
  createGasEnv,
  makeSelection,
  makeRangeElement,
  makeTextElement,
  makeNamedRangeElement,
  makeNamedRange,
};
