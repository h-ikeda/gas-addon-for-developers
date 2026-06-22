// 名前付き範囲ハイライト機能で使う純粋ヘルパー群。
// namedRangeHelpers.js と同様に GAS の API へ直接依存させず、入力と出力だけで完結させて
// 単体テストしやすくしている（GAS では全 .js がグローバルスコープを共有するため、ここで
// 宣言した関数・定数は コード.js からそのまま参照できる。module.exports は使わない）。

// 名前付き範囲を塗るハイライト色（薄い黄色）。
const HIGHLIGHT_COLOR = '#fff475';

// 名前付き範囲をハイライトする際に、範囲のテキストの代わりに表示するラベルを組み立てる。
// 例: 名前が "見出し" なら "{{ 見出し }}" を返す。前後の空白は取り除く。
function formatNamedRangeLabel(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return '{{ ' + trimmed + ' }}';
}

// ハイライト前の背景色スナップショットを保存する DocumentProperties のキー。
const HIGHLIGHT_SNAPSHOT_KEY = 'namedRangeHighlightSnapshot';

// RangeElement が指すテキストのうち、ハイライト対象となる開始・終了オフセット（両端含む）を求める。
// 部分選択ならそのオフセット範囲を、要素全体ならテキスト全体（0〜length-1）を返す。
// 対象テキストが空（length が 0 以下）で色を付けられない場合は null を返す。
function getRangeElementBounds(rangeElement, textLength) {
  if (rangeElement.isPartial()) {
    return {
      start: rangeElement.getStartOffset(),
      end: rangeElement.getEndOffsetInclusive(),
    };
  }
  if (textLength <= 0) {
    return null;
  }
  return { start: 0, end: textLength - 1 };
}

// テキスト要素の [start, end]（両端含む）区間について、背景色が一定な区間（ラン）の配列を返す。
// 各ランは { start, end, color }。color は getBackgroundColor(offset) の戻り値（無指定なら null）。
// 元の背景色を後で正確に復元するため、書式が切り替わる位置（getTextAttributeIndices）で区切る。
function computeBackgroundColorRuns(textElement, start, end) {
  const indices =
    typeof textElement.getTextAttributeIndices === 'function'
      ? textElement.getTextAttributeIndices()
      : null;

  // 区間の先頭は必ず境界。さらに [start, end] の内側にある書式変更位置を境界に加える。
  const boundaries = [start];
  if (indices) {
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      if (idx > start && idx <= end) {
        boundaries.push(idx);
      }
    }
  }

  const runs = [];
  for (let i = 0; i < boundaries.length; i++) {
    const runStart = boundaries[i];
    const runEnd = i + 1 < boundaries.length ? boundaries[i + 1] - 1 : end;
    runs.push({
      start: runStart,
      end: runEnd,
      color: textElement.getBackgroundColor(runStart),
    });
  }
  return runs;
}
