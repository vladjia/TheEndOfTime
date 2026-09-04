# 《時盡》網站核心 v0.9.4

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


## v0.7：角色印記 / Living Seals

古風展示字體大幅收斂：
- 保留：首頁「時盡」、左上「時」、角色印記
- 恢復原字體：角色名稱、章節標題、世界觀標題、引言、正文

角色卡右下角識別印記：
- 家式 → 家：停時 / 短暫切片感
- 白霽 → 白：極輕微呼吸漂移
- 葉慎行 → 月半：沉穩，hover 出現刀痕
- 安言修 → 蝶：偶爾出現黑蝶殘影

動畫皆支援 `prefers-reduced-motion`。


## v0.7.1：角色印記位置修正
- 四張角色卡右下角印記整體上提
- 不再讓字被卡片底邊裁切
- 「月半」使用獨立位置，確保雙字完整顯示


## v0.8：首頁進場動畫

首頁正式故事鉤子：
「他活過世界的終點，卻沒能逃過那些早已注定的結局。」

核心法則：
「過程可以改變，結果不能。」

進場節奏：
1. 一道極細時間沙落下
2. 沙在途中停止
3. THE END OF TIME 淡入
4. 「時盡」像從黑暗中顯影
5. 故事鉤子出現
6. 世界法則最後亮起極淡血紅
7. 操作按鈕出現
8. 動畫停止，不循環

主視覺只做暗處顯影，不滑入、不縮放、不讓人物持續晃動。


## v0.9：迎賓頁 / START

首頁前新增獨立迎賓層：
- 全黑冷色背景
- THE END OF TIME
- 古風展示字「時盡」
- START 按鈕
- 一道極細時間沙落下後停住

按下 START 後：
- 迎賓頁淡出
- 才開始播放真正首頁的進場動畫
- 首頁故事鉤子與核心法則保留既有定案
- 不加入 BGM / SFX，避免自動播放與干擾；音訊系統可另案設計

README 首行版本號自本版起同步更新。


## v0.9.1：迎賓頁細修

- 「時盡」兩字加大字距，避免過於擁擠
- `THE END OF TIME` 移到「時盡」下方
- 英文改為低透明、輕微虛化、向下漸隱的時間殘影
- 只加入極輕微折射漂移，不做明顯水波
- START 位置重新平衡
- 手機版另行縮小字距與英文殘影比例


## v0.9.2：迎賓頁轉化式重構

迎賓頁不再把 `THE END OF TIME` 當成小型副標，而改為：

- 上層：大型古風字「時盡」
- 中層：細微流沙 / 時間漏落
- 下層：大型英文概念形體 `THE END OF TIME`
- 最下：START

設計目的：
- 讓畫面讀起來像「時盡」往下漏成 `THE END OF TIME`
- 英文與中文形成上下呼應，而不是標題 / 副標關係
- START 獨立成第三層操作，不再貼近英文殘影

另外保留：
- 全黑迎賓背景
- 極淡血紅氛圍
- 不加入突兀的大量特效
- 無障礙減少動態支援


## v0.9.3：真流沙修正版

- 移除 v0.9.2 中央那條突兀的直線與假顆粒
- 改用 Canvas 真粒子流沙
- 流沙從「時」「盡」兩個字的下方區域分別落下
- 粒子下墜時有重力、輕微左右漂移與逐步消散
- 少量粒子帶極淡血紅，仍以冷白灰為主
- THE END OF TIME 稍微提高可讀性，但仍維持虛化與時間殘影感
- START 維持獨立，不與英文黏在一起


## v0.9.4：流沙可視修正

這版專門修正「看不到流沙」：
- CSS / JS 加入版本參數，避免 GitHub Pages / 瀏覽器沿用舊快取
- Canvas 初始化時先預填粒子，不再先出現一大片空白
- 粒子密度提高
- 下落速度放慢
- 粒徑稍微加大
- 部分粒子加入短拖尾，讓「流」更容易被看見
- 粒子從「時」「盡」兩個字底部寬區域分別落下，而不是中央單點
