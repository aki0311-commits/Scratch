# TexTage 皿の押し引き

既存公開サイトの完成版（バージョン60）をコピーしたものです。元のサイトはそのまま利用できます。

## GitHub Pagesで公開

このフォルダーの中身をリポジトリにアップロードし、Settings → Pages → Deploy from a branch → main /docs を選んで保存してください。

## 使い方

公開されたページでiPhone用／Android用のブックマークコードをコピーし、TexTageの譜面ページで起動します。
Android用コードはコピー先の公開URLからb.jsを読み込みます。

## ファイル

- `src/bookmarklet.js`：編集用ソース
- `docs/index.html`：案内ページとiPhone用コード
- `docs/b.js`：Android用コード（ASCIIエスケープ版）
- `docs/*.gif`：模擬譜面用画像

早入り上限116.7ms、110ms超はオレンジ枠。変換後の間隔で枚数と矢印を表示します。

## ソース更新

`src/bookmarklet.js`を編集した後、`python3 scripts/build.py`で公開用コピーを更新します。

TexTageの非公式補助ツールです。
