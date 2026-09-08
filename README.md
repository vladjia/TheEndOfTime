<div align="center">

# 《時盡》 · THE END OF TIME

### 互動式敘事／探索網站

**他活過世界的終點，卻沒能逃過那些早已注定的結局。**

> **過程可以改變，結果不能。**

<br>

[![Website](https://img.shields.io/badge/進入《時盡》-111318?style=for-the-badge)](https://vladjia.github.io/TheEndOfTime/)
[![Site](https://img.shields.io/endpoint?url=https%3A%2F%2Fscript.google.com%2Fmacros%2Fs%2FAKfycbwpF5cAHbnIFphMdrd5jLcGs0rmt8li7aYSZ4Y47CU1tEOLwYXMv1bVDKOqQqKilOA%2Fexec%3Faction%3DversionBadge%26type%3Dsite&cacheSeconds=300)](https://github.com/vladjia/TheEndOfTime)
[![CORE](https://img.shields.io/endpoint?url=https%3A%2F%2Fscript.google.com%2Fmacros%2Fs%2FAKfycbwpF5cAHbnIFphMdrd5jLcGs0rmt8li7aYSZ4Y47CU1tEOLwYXMv1bVDKOqQqKilOA%2Fexec%3Faction%3DversionBadge%26type%3Dcore&cacheSeconds=300)](https://github.com/vladjia/TheEndOfTime)

</div>

---

## 關於《時盡》

《時盡》是一套結合 **劇情閱讀、角色檔案、世界觀探索與個人旅程紀錄** 的互動式網站。

> **讀到哪裡，世界就存在到哪裡。**

未解鎖的內容不以鎖頭、`???` 或空白卡片提示存在。  
在玩家尚未走到那個時間點以前，那些資訊就不應該出現在他的世界裡。

---

## 快速入口

| 區域 | 入口 |
|---|---|
| 首頁 | [進入《時盡》](https://vladjia.github.io/TheEndOfTime/) |
| 故事 | [故事](https://vladjia.github.io/TheEndOfTime/story/) |
| 角色 | [角色](https://vladjia.github.io/TheEndOfTime/characters/) |
| 世界觀 | [世界觀](https://vladjia.github.io/TheEndOfTime/world/) |
| 目前旅程 | [旅程](https://vladjia.github.io/TheEndOfTime/journey/) |
| 時印幻境 | [時印幻境](https://vladjia.github.io/TheEndOfTime/timemark/) |

---

## 目前功能

- 劇情閱讀與閱讀進度
- 角色檔案與角色圖誌
- 角色認知分層：同一角色的內容隨旅程逐段開啟
- 世界觀逐步解鎖
- 時印系統與個人旅程
- 十二時辰母石：依讀者進站時辰認主
- 時辰字刻印，並依石片明暗自動切換亮刻／暗刻
- 單一光源色與琉璃折光
- 個人本命刻紋
- 時印序與接力碼
- 網站有效停留統計與停留分析看板
- Google Drive 圖片／影片同步
- DEV FULL 完整版預覽

---

## 時印

玩家只需要選擇一個自己的光源色。

母石不是隨機分配，而是**由進站當下的時辰決定**——子時進來的人，得到子時的石片。石片中央刻著該時辰的字，並依所選光源色的明暗，自動切換為亮刻或暗刻。

系統會依旅程逐步留下屬於這名玩家的時印與時痕。

> **十二時辰母石 = 你從哪裡來**  
> **個人時印刻紋 = 你是誰**  
> **後續時痕 = 你走過什麼**

---

## 技術

- GitHub Pages
- GitHub Actions（自動部署與快取版號改寫）
- HTML / CSS / JavaScript
- Google Apps Script
- Google Sheets
- Google Drive

---

## 部署

推送到 `main` 後由 GitHub Actions 自動部署。

流程會在部署當下，把全站所有 `?v=` 快取版號改寫為 `日期-commit`，**因此不需要手動維護版號**。

```text
push  →  改寫全站 ?v=  →  發佈至 GitHub Pages
```

> repo 原始碼中的 `?v=` 數字不會變動，這是正常的；只有實際上線的檔案會被改寫。

---

## 顯示字型

顯示字型已子集化為網站實際用字，母檔不放進 repo。

新增 **詩號、印記、字訣、招式名、角色名、稱號、章節名或網站文案** 時，可能出現子集尚未涵蓋的字，需重新產生字型子集。

```javascript
診斷_產生字型字集()   // 產生目前所需的字集清單
```

> 小說正文使用內文字型，不受此限制。

---

## Drive 媒體同步

```javascript
syncDriveMedia()
```

`syncDriveImages()` 僅保留舊版相容。

---

## GAS 檔案分工

| 檔案 | 定位 |
|---|---|
| `PERMANENT.gs` | 網站執行時真正會用到的功能 |
| `MIGRATION.gs` | 一次性遷移，跑完即結束 |
| `DIAGNOSTIC.gs` | 反覆手動執行的診斷與 DEV 工具 |

---

## DEV 與診斷工具

```javascript
markDeveloperTimeMark()
resetMyDevTimeMarkCompletely()
setMyDevPreviewFull()
setMyDevPreviewOff()

診斷_資料庫總覽()
診斷_匯出資料庫()
診斷_時辰對照表()
診斷_產生字型字集()
```

> `resetMyDevTimeMarkCompletely()` 只重置試算表，瀏覽器快取需另外清除；函式執行後會印出所需指令。

### 時痕實驗室

`dev/scar-lab.html` — 時痕刻印的參數調校台。拉滑桿即時重畫石片，含呼吸與流動動畫。

<https://vladjia.github.io/TheEndOfTime/dev/scar-lab.html>

> 內部工具，不從網站任何地方連出去，也不影響線上功能。
> 必須從網址開啟；用 `file://` 直接開會被瀏覽器擋住 Canvas 讀取。

---

## 版本來源

版本的唯一真相是「版本紀錄」工作表的 **種類** 欄（`SITE` / `CORE` / `DATA`）。

- `Site` Badge：讀取種類為 `SITE` 的最後一筆
- `CORE` Badge：讀取種類為 `CORE` 的最後一筆
- 網站頁尾：同一來源，一併輸出

改版時只需在「版本紀錄」補上一列並填好種類，Badge 與頁尾都會自動跟上。

> 「網站設定」中舊有的 `site_version` / `data_version` / `core_version` 已停用並移除。

---

<div align="center">

[首頁](https://vladjia.github.io/TheEndOfTime/) ·
[故事](https://vladjia.github.io/TheEndOfTime/story/) ·
[角色](https://vladjia.github.io/TheEndOfTime/characters/) ·
[世界觀](https://vladjia.github.io/TheEndOfTime/world/) ·
[時印幻境](https://vladjia.github.io/TheEndOfTime/timemark/)

<br>

**過程可以改變，結果不能。**

</div>
