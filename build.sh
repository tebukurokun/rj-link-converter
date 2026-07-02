#!/usr/bin/env bash
#
# 配布用 ZIP を dist/ に生成する。
#   - dist/dlsite-link-converter-chrome.zip   (Chromium 系: manifest.json をそのまま使用)
#   - dist/dlsite-link-converter-firefox.zip  (Firefox: manifest.firefox.json を manifest.json として同梱)
#
# 使い方: ./build.sh
#
set -euo pipefail

cd "$(dirname "$0")"

DIST_DIR="dist"
NAME="dlsite-link-converter"

# 拡張機能本体に含めるファイル（manifest はターゲットごとに個別で追加する）
COMMON_FILES=(
  content.js
  background.js
  popup.html
  popup.js
  icon16.png
  icon32.png
  icon96.png
)

# 依存ファイルの存在チェック
for f in "${COMMON_FILES[@]}" manifest.json manifest.firefox.json; do
  if [[ ! -f "$f" ]]; then
    echo "エラー: $f が見つかりません" >&2
    exit 1
  fi
done

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# ステージング用の一時ディレクトリを作り、そこから zip 化する。
# （Firefox 用は manifest.firefox.json を manifest.json という名前で入れる必要があるため）
build() {
  local target="$1"       # chrome | firefox
  local manifest_src="$2" # 同梱する manifest ファイル
  local stage
  stage="$(mktemp -d)"

  cp "${COMMON_FILES[@]}" "$stage/"
  cp "$manifest_src" "$stage/manifest.json"

  local zip_path
  zip_path="$(pwd)/$DIST_DIR/${NAME}-${target}.zip"
  ( cd "$stage" && zip -q -r -X "$zip_path" . )
  rm -rf "$stage"
  echo "作成: $DIST_DIR/${NAME}-${target}.zip"
}

build chrome  manifest.json
build firefox manifest.firefox.json

echo "完了。AMO には dist/${NAME}-firefox.zip をアップロードしてください。"
