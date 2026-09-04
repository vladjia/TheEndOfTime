# 《時盡》網站核心 v0.5

這一版開始把「網站核心」與「內容資料」分離，方便未來持續改版。

## 結構

- `index.html`：公開入口 + SEO / Open Graph
- `app/site.css`：網站視覺與動畫
- `app/site.js`：資料讀取與互動
- `data/config.json`：版本、Google Drive/GAS endpoint、字型設定
- `data/characters.json`：公開角色資料
- `data/world.json`：公開世界觀資料
- `data/story.json`：公開故事文字與未來劇透 endpoint
- `assets/images/og-cover.png`：LINE / Facebook 分享預覽圖
- `assets/fonts/`：正式網站字型位置
- `assets/effects/`：特效素材

## GitHub / Pages

- Repository: https://github.com/vladjia/TheEndOfTime
- GitHub Pages: https://vladjia.github.io/TheEndOfTime/

OG 分享爬蟲通常不執行 JavaScript，所以 `og:url` 與 `og:image` 必須直接寫在 index.html 裡，不能只放 config.json。

## LINE / Facebook 預覽

目前已包含：
- meta description
- og:title
- og:description
- og:type
- og:url
- og:image
- og:image:width / height
- twitter:card

預覽圖尺寸：1200 × 630。

## 未來更新方式

版型/功能更新通常只覆蓋：
- `app/site.css`
- `app/site.js`
- 必要時 `index.html`

角色內容與圖片來源會逐步移到資料層 / Google Drive + GAS，避免改版時重做。


## v0.5：Google Sheet / GAS 已接線

公開 API：
https://script.google.com/macros/s/AKfycbwpF5cAHbnIFphMdrd5jLcGs0rmt8li7aYSZ4Y47CU1tEOLwYXMv1bVDKOqQqKilOA/exec

網站載入順序：
1. 先讀 `data/config.json` 取得 GAS endpoint
2. 呼叫 GAS `?type=public`
3. 成功時以 Google Sheet / Drive 資料渲染
4. GAS 暫時失效時，自動退回 GitHub 內的本機 JSON 備援資料

### 重要安全規則
公開 Web App 不應輸出 `authorNotes`。
作者模式日後會改成獨立、需要授權的 GAS / Google 登入流程。


## v0.6：特殊展示字型

新增：
- `assets/fonts/TheEndOfTimeDisplay.ttf`
- CSS `@font-face`
- `--font-display`

特殊展示字型只套用：
- 首頁「時盡」
- 章節大標
- 角色正式稱號
- 世界觀標題
- 關鍵引言
- 品牌「時」字

正文仍使用清楚的系統黑體，避免長時間閱讀造成視覺疲勞。
