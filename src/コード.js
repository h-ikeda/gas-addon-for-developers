// アドオンが初回インストールされたときに実行される必須処理
function onInstall(e) {
  onOpen(e);
}

// ドキュメントが開かれたときに「拡張機能」の中にメニューを追加する
function onOpen(e) {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem('選択範囲を名前付き範囲に設定', 'showNamedRangeDialog')
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
