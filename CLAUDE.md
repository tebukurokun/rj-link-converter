# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chromium 系ブラウザ（Chrome / Edge / Brave / Opera / Vivaldi）向けの Manifest V3 拡張機能。
任意のページ内に含まれる DLsite の作品番号（`RJ` + 6桁以上の数字）を検出し、DLsite の該当ページへのリンクへ自動変換する。

## Development

ビルド・テスト・Lint のツールチェーンは無く、依存パッケージも無い（`content.js` はプレーンな IIFE）。開発フローは手動:

- **読み込み**: `chrome://extensions`（または各ブラウザの拡張機能管理ページ）でデベロッパーモードを有効にし、「パッケージ化されていない拡張機能を読み込む」でこのフォルダ（`manifest.json` がある場所）を選択する。
- **変更の反映**: コード変更後、拡張機能管理ページで「再読み込み」（🔄）を押してから、対象ページをリロードして動作確認する。
- **デバッグ**: 対象ページの DevTools コンソールに、変換処理のエラーが `console.error` で出力される。

## Architecture

3つの実行コンテキストで構成される Manifest V3 拡張機能:

- **`content.js`** — 全ページに注入され、RJ 番号をリンクへ変換し、リンククリックを記録する（`<all_urls>` / `run_at: "document_end"`）。
- **`background.js`** — Service Worker。`content.js` からの `recordClick` メッセージを受け、DLsite API で作品タイトルを取得して `chrome.storage.local` に履歴を保存する。
- **`popup.html` / `popup.js`** — ツールバーアイコンのポップアップ。`chrome.storage.local` の履歴を一覧表示・削除する。

### content.js

全ロジックは1つの IIFE 内にあり、先頭の `CONFIG` オブジェクトに正規表現・URL・スタイル・デバウンス時間などの設定を集約している。

処理の流れ:

1. `init()` — DOM 準備後に `processPage()` と `setupMutationObserver()` を呼ぶ。
2. `processPage()` → `processTextNodes()` — `TreeWalker`（`SHOW_TEXT`）でテキストノードを収集し、**逆順**に処理する（DOM 変更による走査中のインデックスずれを避けるため）。
3. `shouldProcessTextNode()` — 変換対象の判定。`CONFIG.EXCLUDED_TAGS`（`A` / `SCRIPT` / `STYLE` / `NOSCRIPT`）内や、処理済みマーカー（`CONFIG.PROCESSED_CLASS`）を持つ要素はスキップ。**既存リンクを二重リンク化しない**のが重要な不変条件。
4. `convertRJNumbers()` — テキストノードを `DocumentFragment` に組み直し、RJ 番号部分を `createRJLink()` のアンカーへ置換する。
5. `setupMutationObserver()` — SPA など動的に追加されるノードを監視。`MUTATION_DEBOUNCE`（200ms）でバッチ化し、切断済みノード（`!node.isConnected`）はスキップする。

### クリック履歴（background / popup）

- `content.js` の `recordClick()` が `chrome.runtime.sendMessage({ type: "recordClick", ... })` を送る。応答は不要なため送信側は callback を使わない。
- `background.js` はタイトルを **DLsite の商品情報 API**（`https://www.dlsite.com/maniax/api/=/product.json?workno=RJ...`、配列で返り `work_name` を含む）から取得する。取得失敗時は `title: null` で保存し、popup は RJ 番号で代替表示する。この fetch のために `host_permissions: ["https://www.dlsite.com/*"]` が必須。
- 保存形式は `chrome.storage.local` の `clickHistory` キー配列。同一 RJ 番号は先頭へ移動し `count` を加算（＝重複せず最新クリック順）。`MAX_ENTRIES`（300）で上限管理。
- `popup.js` は履歴の描画をすべて DOM API / `textContent` で行う（作品タイトルやページタイトルを含むため HTML インジェクション防止）。

### 注意すべき点

- 生成リンクは `click` イベントで `stopPropagation()` を呼ぶ。これは SNS（Twitter/X 等）でツイートカード全体のクリックイベント（詳細を開く等）が同時発火するのを防ぎ、通常リンクと同じ挙動にするため。同種の問題が別イベント（`mousedown` 等）で起きる場合は同様の対応が必要になりうる。同じ `click` ハンドラ内で履歴記録も行っている。
- `CONFIG.RJ_PATTERN` はグローバル正規表現のため `lastIndex` を持つ。判定には `lastIndex` を汚さない `String.prototype.search` を、抽出には `matchAll` を使い分けている。
- `manifest.json` の `permissions` は空。新たにブラウザ API を使う場合はここへの追加が必要。
