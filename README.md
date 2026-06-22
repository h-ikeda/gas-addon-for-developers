# gas-addon-for-developers

Google ドキュメント用の開発支援アドオンです。開発時に便利な小さなツールを少しずつまとめていきます。

## 機能

### 選択範囲を名前付き範囲に設定

1. ドキュメント上で文字列を選択します。
2. メニュー **拡張機能 → gas-addon-for-developers → 選択範囲を名前付き範囲に設定** を実行します。
3. 名前付き範囲の名前を入力するダイアログが表示されます（初期値は選択中の文字列）。
4. **OK** を押すと、選択していた範囲が名前付き範囲（NamedRange）として登録されます。

### 名前付き範囲をハイライト

1. メニュー **拡張機能 → gas-addon-for-developers → 名前付き範囲をハイライト** を実行します。
2. ドキュメント内のすべての名前付き範囲のテキストが `{{ 範囲の名前 }}` という表示に置き換わり、
   背景色でハイライトされます。あわせて実行停止用の小さな非ブロッキング（モードレス）ダイアログが現れます。
3. ダイアログの **閉じる** を押すと、ハイライトが解除され、元のテキストと背景色に戻ります。

> ハイライト前のテキストと背景色は `DocumentProperties` に保存し、解除時にそのまま書き戻します。
> 範囲が複数の要素にまたがる場合は、先頭の要素にだけ `{{ 範囲の名前 }}` ラベルを表示します。
> ダイアログをウィンドウの×で閉じてもハイライトは残りますが、もう一度コマンドを実行すれば
> いったん元へ戻してから貼り直すため、元のテキストや色が失われることはありません。

## 開発

### 必要環境

- Node.js 24 以上
- [clasp](https://github.com/google/clasp)（デプロイ時のみ。`npm install -g @google/clasp`）

### セットアップ

```bash
npm install
```

### テスト

[Jest](https://jestjs.io/) を使用しています。GAS のグローバル API（`DocumentApp` など）はモックに差し替え、
ダイアログ側の処理は [jsdom](https://github.com/jsdom/jsdom) で評価してテストします。

```bash
npm test
```

### ファイル構成

clasp がプッシュするのは `src/` 配下のみです（`.clasp.json` の `rootDir` を `src` に設定）。
テストやビルド設定は `src/` の外に置くため、テストファイルが Apps Script へプッシュされることはありません。

| ファイル | 役割 |
| --- | --- |
| `src/コード.js` | アドオン本体（メニュー登録・ダイアログ表示・名前付き範囲の登録／ハイライト） |
| `src/namedRangeHelpers.js` | GAS API に依存しない純粋ヘルパー（選択テキスト抽出・名前の検証） |
| `src/highlightHelpers.js` | ハイライト用の純粋ヘルパー（対象範囲の算出・背景色ランの抽出・ラベル整形）と定数 |
| `src/Dialog.html` | 名前入力ダイアログの UI |
| `src/DialogJavaScript.html` | ダイアログのクライアント側スクリプト |
| `src/HighlightDialog.html` | ハイライト停止ダイアログの UI |
| `src/HighlightDialogJavaScript.html` | ハイライト停止ダイアログのクライアント側スクリプト |
| `src/appsscript.json` | Apps Script マニフェスト |
| `.clasp.json` | clasp 設定（`rootDir: src` / `scriptId` は CI で実値に置換） |
| `test/` | Jest テストとモックヘルパー |

## Google Workspace 側の設定

このアドオンを動かす・公開するために必要な Google 側の作業です。

### 1. Apps Script プロジェクトを作成して紐付ける

1. [Google Apps Script](https://script.google.com/) で新しいプロジェクトを作成します
   （またはテスト用の Google ドキュメントから「拡張機能 → Apps Script」で作成）。
2. 作成したプロジェクトの **設定 → スクリプト ID** を控えます。
3. ローカルでは `.clasp.json` の `scriptId` をこの値に置き換えるか、`clasp clone <スクリプトID>` で取得します。
   （リポジトリ上は `SCRIPT_ID_PLACEHOLDER` のままにしておき、CI のデプロイ時に Secret から注入します。）

### 2. clasp の認証

ローカルからプッシュする場合:

```bash
clasp login
```

`~/.clasprc.json` に認証情報が作成されます。**このファイルはコミットしないでください**
（`.gitignore` で除外済み）。

### 3. マニフェストと OAuth スコープ

`appsscript.json` で以下を宣言済みです。Apps Script プロジェクトの
**設定 → 「appsscript.json」マニフェスト ファイルをエディタで表示する** を有効にすると確認できます。

- `https://www.googleapis.com/auth/documents.currentonly` — 現在開いているドキュメントの読み書き
- `https://www.googleapis.com/auth/script.container.ui` — メニュー／ダイアログの表示

### 4. 動作確認（テストデプロイ）

1. Apps Script エディタで **デプロイ → デプロイをテスト** を開きます。
2. **アドオン（エディタ アドオン / Docs）** を選び、テスト用ドキュメントを指定して実行します。
3. ドキュメントを開き、上記「機能」の手順でメニューが表示されることを確認します。

### 5. GitHub Actions での自動デプロイ

`main` への push で `.github/workflows/deploy.yml` が `clasp push` / `clasp deploy` を実行します。
リポジトリの **Settings → Secrets and variables → Actions** に次の Secret を登録してください。

| Secret 名 | 内容 |
| --- | --- |
| `CLASPRC_JSON` | ローカルの `~/.clasprc.json` の中身（clasp 認証情報） |
| `GAS_SCRIPT_ID` | Apps Script プロジェクトのスクリプト ID |
| `GAS_DEPLOYMENT_ID` | 更新対象のデプロイ ID（`clasp deployments` で確認） |

> 認証情報を Secret に保存する都合上、リポジトリの公開範囲やアクセス権には注意してください。

### 6. Marketplace への公開とバージョン更新（重要）

Google Workspace Marketplace は **固定のバージョン番号** に紐づきます。
`clasp push` で反映されるのは「下書き（編集中のコード）」であり、これだけでは公開版に反映されません。
**コードを更新したら、必ず新しいバージョンを確定し、Marketplace 側のバージョン指定を上げ直してください。**

更新のたびに以下を行います。

1. **コードを反映**：`clasp push`（CI の `main` push でも実行されます）
2. **新しいバージョンを確定**：以下のいずれか
   - `clasp version "変更内容のメモ"` （返ってきた番号を控える）
   - Apps Script エディタ → **デプロイ → デプロイを管理 → ✏️編集 → バージョン → 新バージョン**
3. **Marketplace のバージョンを更新**：Google Cloud Console → Google Workspace Marketplace SDK →
   **App Configuration → Docs add-on → version** を 2 で確定した番号に変更して保存
4. **利用者側**：対象ドキュメントを**再読み込み**すると、新しいメニュー／挙動が反映されます

> よくあるハマりどころ: 更新したバージョンが**下書きのまま**だと、メニュー項目（`onOpen` で追加）が
> 反映されず「拡張機能にアドオン名は出るがコマンドが出ない」状態になります。必ず手順 2〜3 を実施してください。
>
> メニュー項目は `onOpen` がドキュメント読み込み時に実行して作るため、インストール／更新の直後は
> **ドキュメントの再読み込み**が必要です。

## マーケットプレイス掲載用アセット

Google Workspace Marketplace（限定公開）のストア掲載で使用する画像を `assets/` に用意しています。

| ファイル | サイズ | 用途 |
| --- | --- | --- |
| `assets/icon_32.png` | 32×32 | アプリアイコン（小） |
| `assets/icon_128.png` | 128×128 | アプリアイコン（大） |
| `assets/banner_220x140.png` | 220×140 | プロモーションバナー |
| `assets/screenshot.png` | 1280×800 | 機能イメージ（スクリーンショット） |

画像は `assets/generate_assets.py`（Pillow 使用）で再生成できます。

```bash
pip install Pillow
python3 assets/generate_assets.py
```
