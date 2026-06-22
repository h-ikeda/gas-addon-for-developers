// アドオンが初回インストールされたときに実行される必須処理
function onInstall(e) {
  onOpen(e);
}

// ドキュメントが開かれたときに「拡張機能」の中にメニューを追加する
function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('選択範囲を名前付き範囲に設定', 'showNamedRangeDialog')
    .addItem('名前付き範囲をハイライト', 'highlightNamedRanges')
    .addToUi();
}

// HTMLファイルの内容を別のHTMLテンプレートに取り込むためのヘルパー。
// Dialog.html から <?!= include('DialogJavaScript') ?> として呼び出される。
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// 名前付き範囲の名前を入力するダイアログを表示する
function showNamedRangeDialog() {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  // 選択範囲が無ければ名前付き範囲を作れないので、案内して終了する
  if (!selection) {
    DocumentApp.getUi().alert('名前付き範囲に設定したいテキストを選択してから実行してください。');
    return;
  }

  // 選択中のテキストをダイアログの初期値として渡す
  const template = HtmlService.createTemplateFromFile('Dialog');
  template.defaultName = extractSelectedText(selection);
  const htmlOutput = template
    .evaluate()
    .setWidth(400)
    .setHeight(160)
    .setTitle('名前付き範囲の設定');
  DocumentApp.getUi().showModalDialog(htmlOutput, '名前付き範囲の設定');
}

// HTMLダイアログから名前を受け取り、現在の選択範囲を名前付き範囲として登録する
function setNamedRange(name) {
  if (!isValidNamedRangeName(name)) {
    throw new Error('名前を入力してください。');
  }

  // モーダルダイアログ表示中もドキュメントの選択状態は保持されるため、
  // ここで改めて選択範囲を取得して名前付き範囲に変換する。
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();
  if (!selection) {
    throw new Error('選択範囲が見つかりません。テキストを選択してから再実行してください。');
  }

  const trimmedName = name.trim();
  doc.addNamedRange(trimmedName, selection);
  return `「${trimmedName}」を名前付き範囲に設定しました。`;
}

// ドキュメント内の名前付き範囲をすべてハイライト表示し、
// 停止用の小さな非ブロッキング（モードレス）ダイアログを開く。
function highlightNamedRanges() {
  const doc = DocumentApp.getActiveDocument();

  // 既にハイライト中（前回のダイアログを×で閉じた等）なら、まず元へ戻してから貼り直す。
  // そうしないと「ハイライト色」を元の色として記録してしまう。
  clearNamedRangeHighlight();

  const namedRanges = doc.getNamedRanges();
  if (!namedRanges || namedRanges.length === 0) {
    DocumentApp.getUi().alert('名前付き範囲がありません。');
    return;
  }

  // 元の背景色をスナップショットに記録しつつハイライトを適用する。
  // ダイアログの「閉じる」は別実行になりグローバル変数は引き継がれないため、
  // 復元用データは DocumentProperties に永続化しておく。
  const snapshot = applyHighlight(namedRanges, HIGHLIGHT_COLOR);
  PropertiesService.getDocumentProperties()
    .setProperty(HIGHLIGHT_SNAPSHOT_KEY, JSON.stringify(snapshot));

  const htmlOutput = HtmlService.createTemplateFromFile('HighlightDialog')
    .evaluate()
    .setWidth(320)
    .setHeight(120)
    .setTitle('名前付き範囲のハイライト');
  DocumentApp.getUi().showModelessDialog(htmlOutput, '名前付き範囲のハイライト');
}

// 各名前付き範囲のテキストを「{{ 範囲の名前 }}」ラベルに置き換えて背景色を付け、
// 復元に必要な情報（元テキスト・挿入したラベル・元の背景色）をスナップショットとして返す。
//
// ラベルは範囲の先頭テキスト要素にだけ挿入し、範囲が複数要素にまたがる場合は残りの
// 要素のテキストを取り除く。こうすることで、範囲全体に対してラベルが一度だけ表示される。
function applyHighlight(namedRanges, color) {
  const snapshot = [];
  for (let n = 0; n < namedRanges.length; n++) {
    const namedRange = namedRanges[n];
    const label = formatNamedRangeLabel(namedRange.getName());
    const rangeElements = namedRange.getRange().getRangeElements();
    const elementSnapshots = [];
    let labelPlaced = false;
    for (let i = 0; i < rangeElements.length; i++) {
      const rangeElement = rangeElements[i];
      const element = rangeElement.getElement();

      // テキストとして編集できない要素（インライン画像・水平線など）は置き換えられないので飛ばす。
      if (!element || typeof element.editAsText !== 'function') {
        continue;
      }
      const text = element.editAsText();
      const bounds = getRangeElementBounds(rangeElement, text.getText().length);
      if (!bounds) {
        continue;
      }

      // 置き換え前に、元の背景色と元テキストを記録しておく（解除時の復元に使う）。
      const runs = computeBackgroundColorRuns(text, bounds.start, bounds.end);
      const originalText = text.getText().substring(bounds.start, bounds.end + 1);

      // 範囲のテキストを削除し、先頭要素にだけラベルを挿入してハイライト色で塗る。
      text.deleteText(bounds.start, bounds.end);
      let inserted = '';
      if (!labelPlaced) {
        text.insertText(bounds.start, label);
        text.setBackgroundColor(bounds.start, bounds.start + label.length - 1, color);
        inserted = label;
        labelPlaced = true;
      }

      elementSnapshots.push({
        start: bounds.start,
        originalText: originalText,
        inserted: inserted,
        runs: runs,
      });
    }
    snapshot.push({ elements: elementSnapshots });
  }
  return snapshot;
}

// ハイライトを解除し、保存しておいた元の背景色へ戻す。停止ダイアログの「閉じる」から呼ばれる。
function clearNamedRangeHighlight() {
  const props = PropertiesService.getDocumentProperties();
  const raw = props.getProperty(HIGHLIGHT_SNAPSHOT_KEY);
  if (!raw) {
    // ハイライト中でなければ何もしない（×で閉じた後の再実行などでも安全に呼べる）。
    return;
  }

  const snapshot = JSON.parse(raw);
  const namedRanges = DocumentApp.getActiveDocument().getNamedRanges();
  restoreHighlight(namedRanges, snapshot);
  props.deleteProperty(HIGHLIGHT_SNAPSHOT_KEY);
}

// スナップショットに記録した内容を使って、ラベルを元のテキストへ戻し、背景色も復元する。
// applyHighlight と同じ順序で名前付き範囲・テキスト要素をたどることで対応付ける。
function restoreHighlight(namedRanges, snapshot) {
  for (let n = 0; n < namedRanges.length && n < snapshot.length; n++) {
    const rangeElements = namedRanges[n].getRange().getRangeElements();
    const elementSnapshots = snapshot[n].elements;
    let si = 0;
    for (let i = 0; i < rangeElements.length; i++) {
      const element = rangeElements[i].getElement();
      if (!element || typeof element.editAsText !== 'function') {
        continue;
      }
      const elementSnapshot = elementSnapshots[si++];
      if (!elementSnapshot) {
        continue;
      }
      const text = element.editAsText();

      // ハイライト時に挿入したラベルを取り除き、元テキストを戻してから背景色を復元する。
      if (elementSnapshot.inserted && elementSnapshot.inserted.length > 0) {
        text.deleteText(
          elementSnapshot.start,
          elementSnapshot.start + elementSnapshot.inserted.length - 1
        );
      }
      text.insertText(elementSnapshot.start, elementSnapshot.originalText);

      for (let r = 0; r < elementSnapshot.runs.length; r++) {
        const run = elementSnapshot.runs[r];
        text.setBackgroundColor(run.start, run.end, run.color);
      }
    }
  }
}
