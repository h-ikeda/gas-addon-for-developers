'use strict';

const { loadGasScript } = require('./helpers/loadGasScript');

// 純粋ヘルパーは GAS API に依存しないが、GAS と同じくグローバル関数として
// 読み込まれるため、共通ローダー経由で取り出して直接テストする。
const ctx = loadGasScript({});

// テスト用の RangeElement（テキスト要素を1つ持つ）を組み立てる。
function rangeElement(text, partial, startOffset, endOffsetInclusive) {
  return {
    getElement: () => ({ getText: () => text }),
    isPartial: () => !!partial,
    getStartOffset: () => startOffset,
    getEndOffsetInclusive: () => endOffsetInclusive,
  };
}

function selectionOf(rangeElements) {
  return { getRangeElements: () => rangeElements };
}

describe('extractSelectedText', () => {
  test('選択が無い場合は空文字を返す', () => {
    expect(ctx.extractSelectedText(null)).toBe('');
  });

  test('要素全体が選択されている場合はテキスト全体を返す', () => {
    const selection = selectionOf([rangeElement('Hello', false)]);
    expect(ctx.extractSelectedText(selection)).toBe('Hello');
  });

  test('部分選択の場合はオフセット範囲のテキストを返す', () => {
    // 'Hello World' のうち 'World'（index 6〜10）を選択
    const selection = selectionOf([rangeElement('Hello World', true, 6, 10)]);
    expect(ctx.extractSelectedText(selection)).toBe('World');
  });

  test('複数の要素を連結して返す', () => {
    const selection = selectionOf([
      rangeElement('Foo', false),
      rangeElement('Bar', false),
    ]);
    expect(ctx.extractSelectedText(selection)).toBe('FooBar');
  });

  test('テキストを取得できない要素（画像など）は読み飛ばす', () => {
    const image = { getElement: () => ({}), isPartial: () => false };
    const selection = selectionOf([rangeElement('Foo', false), image]);
    expect(ctx.extractSelectedText(selection)).toBe('Foo');
  });
});

describe('isValidNamedRangeName', () => {
  test('通常の文字列は有効', () => {
    expect(ctx.isValidNamedRangeName('myRange')).toBe(true);
  });

  test('空文字は無効', () => {
    expect(ctx.isValidNamedRangeName('')).toBe(false);
  });

  test('空白のみは無効', () => {
    expect(ctx.isValidNamedRangeName('   ')).toBe(false);
  });

  test('文字列以外（null / undefined）は無効', () => {
    expect(ctx.isValidNamedRangeName(null)).toBe(false);
    expect(ctx.isValidNamedRangeName(undefined)).toBe(false);
  });
});
