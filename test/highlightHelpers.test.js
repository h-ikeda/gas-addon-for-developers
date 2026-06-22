'use strict';

const { loadGasScript } = require('./helpers/loadGasScript');

// 純粋ヘルパーは GAS API に依存しないが、GAS と同じくグローバル関数として
// 読み込まれるため、共通ローダー経由で取り出して直接テストする。
const ctx = loadGasScript({});

describe('formatNamedRangeLabel', () => {
  test('名前を {{ 名前 }} 形式のラベルに整形する', () => {
    expect(ctx.formatNamedRangeLabel('見出し')).toBe('{{ 見出し }}');
  });

  test('前後の空白は取り除く', () => {
    expect(ctx.formatNamedRangeLabel('  greeting  ')).toBe('{{ greeting }}');
  });

  test('文字列以外（null / undefined）は空の名前として扱う', () => {
    expect(ctx.formatNamedRangeLabel(null)).toBe('{{  }}');
    expect(ctx.formatNamedRangeLabel(undefined)).toBe('{{  }}');
  });
});

describe('getRangeElementBounds', () => {
  test('部分選択はそのオフセット範囲を返す', () => {
    const rangeElement = {
      isPartial: () => true,
      getStartOffset: () => 6,
      getEndOffsetInclusive: () => 10,
    };
    expect(ctx.getRangeElementBounds(rangeElement, 100)).toEqual({ start: 6, end: 10 });
  });

  test('要素全体の選択はテキスト全体（0〜length-1）を返す', () => {
    const rangeElement = { isPartial: () => false };
    expect(ctx.getRangeElementBounds(rangeElement, 5)).toEqual({ start: 0, end: 4 });
  });

  test('空テキスト（length 0）は対象が無いので null を返す', () => {
    const rangeElement = { isPartial: () => false };
    expect(ctx.getRangeElementBounds(rangeElement, 0)).toBeNull();
  });
});

describe('computeBackgroundColorRuns', () => {
  // 指定した属性変更位置と背景色マップを持つテキスト要素モック。
  function textElement(attributeIndices, colorMap) {
    return {
      getTextAttributeIndices: () => attributeIndices,
      getBackgroundColor: (offset) => (offset in colorMap ? colorMap[offset] : null),
    };
  }

  test('区間内で背景色が一定なら 1 つのラン（色は先頭の値）になる', () => {
    const el = textElement([], { 0: '#ff0000' });
    expect(ctx.computeBackgroundColorRuns(el, 0, 4)).toEqual([
      { start: 0, end: 4, color: '#ff0000' },
    ]);
  });

  test('色が無い区間は color が null のランになる', () => {
    const el = textElement([], {});
    expect(ctx.computeBackgroundColorRuns(el, 2, 5)).toEqual([
      { start: 2, end: 5, color: null },
    ]);
  });

  test('区間内の書式変更位置でランを分割し、各ランの先頭色を記録する', () => {
    // 0〜2 は赤、3〜5 は色なし
    const el = textElement([0, 3], { 0: '#ff0000', 3: null });
    expect(ctx.computeBackgroundColorRuns(el, 0, 5)).toEqual([
      { start: 0, end: 2, color: '#ff0000' },
      { start: 3, end: 5, color: null },
    ]);
  });

  test('区間の外側にある書式変更位置は境界に含めない', () => {
    // 属性変更位置 2 と 8 のうち、対象区間 [3, 7] に入るものは無い
    const el = textElement([2, 8], { 3: '#00ff00' });
    expect(ctx.computeBackgroundColorRuns(el, 3, 7)).toEqual([
      { start: 3, end: 7, color: '#00ff00' },
    ]);
  });

  test('getTextAttributeIndices を持たない要素でも 1 つのランを返す', () => {
    const el = { getBackgroundColor: () => '#abcdef' };
    expect(ctx.computeBackgroundColorRuns(el, 0, 3)).toEqual([
      { start: 0, end: 3, color: '#abcdef' },
    ]);
  });
});
