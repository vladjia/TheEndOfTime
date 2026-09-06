<div align="center">

# 《時盡》 · THE END OF TIME

### 互動式敘事／探索網站

**他活過世界的終點，卻沒能逃過那些早已注定的結局。**

> **過程可以改變，結果不能。**

<br>

[![Website](https://img.shields.io/badge/進入《時盡》-111318?style=for-the-badge)](https://vladjia.github.io/TheEndOfTime/)
[![Frontend](https://img.shields.io/badge/Frontend-v0.18.26-7F1521?style=for-the-badge)](https://github.com/vladjia/TheEndOfTime)
[![CORE](https://img.shields.io/badge/CORE-v2.6-4B515A?style=for-the-badge)](https://github.com/vladjia/TheEndOfTime)

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
- 世界觀逐步解鎖
- 時印系統
- 十二時辰母石
- 光源色設定
- 個人本命刻紋
- 時印序與接力碼
- 回到上次停留的時間裂縫
- 個人旅程紀錄
- Google Drive 圖片／影片同步
- DEV FULL 完整版預覽

---

## 時印

時印用來記住玩家走過的時間。

> **此刻，已被時印記下。**

目前規則：

- 玩家不需要註冊帳號
- 首次進入會自動建立旅程識別
- 正式時空鑄印前，系統會先回應一枚母石供玩家預覽
- 玩家只需要選擇一個自己的光源色
- 系統會依主色產生琉璃層次與折光
- 正式鑄印後才產生本命刻紋
- 同一名玩家的母石與刻紋永久固定
- 後續故事、角色與世界觀會逐步留下新的時痕

> **個人時印刻紋 = 你是誰**  
> **後續時痕 = 你走過什麼**

---

## Drive 媒體同步

正式同步函式：

```javascript
syncDriveMedia()
```

`syncDriveImages()` 僅保留舊版相容。  
後續正式操作一律使用 `syncDriveMedia()`。

---

## DEV 工具

正式 CORE 已整合常用測試工具：

```javascript
markDeveloperTimeMark()
resetMyDevTimeMarkCompletely()
setMyDevPreviewFull()
setMyDevPreviewOff()
```

---

## 技術

- GitHub Pages
- HTML / CSS / JavaScript
- Google Apps Script
- Google Sheets
- Google Drive

---

## 目前版本

| 系統 | 版本 |
|---|---:|
| Frontend | `v0.18.26` |
| CORE | `v2.6` |
| 個人刻紋 | `v1` |

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
