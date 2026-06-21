// 名前付き範囲機能で使う純粋ヘルパー群。
// GAS では各 .js ファイルがグローバルスコープを共有するため、ここで宣言した関数は
// コード.js からそのまま呼び出せる。GAS の API に直接依存させず、入力と出力だけで
// 完結させることで単体テストしやすくしている（module.exports は使わない）。

// 選択範囲（Selection）から、選択されているテキストを連結して返す。
// 部分選択の場合はオフセット範囲だけを切り出す。テキストを持たない要素（画像など）は読み飛ばす。
function extractSelectedText(selection) {
  if (!selection) {
    return '';
  }

  const rangeElements = selection.getRangeElements();
  let text = '';
  for (let i = 0; i < rangeElements.length; i++) {
    const rangeElement = rangeElements[i];
    const element = rangeElement.getElement();

    // getText を持たない要素（インライン画像・水平線など）はテキスト化できないので無視する
    if (!element || typeof element.getText !== 'function') {
      continue;
    }

    const fullText = element.getText();
    if (rangeElement.isPartial()) {
      // getEndOffsetInclusive は「含む」末尾位置なので +1 して substring に渡す
      text += fullText.substring(
        rangeElement.getStartOffset(),
        rangeElement.getEndOffsetInclusive() + 1
      );
    } else {
      text += fullText;
    }
  }
  return text;
}

// 名前付き範囲の名前として妥当かを判定する。空文字・空白のみ・文字列以外は不可。
function isValidNamedRangeName(name) {
  return typeof name === 'string' && name.trim().length > 0;
}
