// ═══════════════════════════════════════════════════════════
// 角色欄位的階段覆蓋規則 —— 唯一真相
// ───────────────────────────────────────────────────────────
// 「角色」表是預設值，「角色認知內容」有填就蓋掉。
// 這條規則以前抄在兩個地方（角色頁、角色列表頁），
// 結果列表頁少覆蓋六個欄位，嬰兒階段的卡片直接寫出「家式」爆雷。
// 現在只有這一份，兩邊都來這裡拿。
//
// ⚠ 新增任何一個會出現在讀者眼前的角色欄位，就要加進 CHARACTER_OVERRIDABLE，
//   否則那一格永遠顯示成年版的預設值。
//
// ⚠ 新做的頁面只要會顯示角色資料，就必須在它自己的 script 之前載入這個檔。
//   沒載到會直接丟錯讓頁面空掉——空頁面是可以修的，爆雷不能。
// ═══════════════════════════════════════════════════════════

(function (global) {
  'use strict';

  // 每一格文字都要能被階段覆蓋。
  // 「角色」表要填的是【讀者第一次看到這個角色時該看到的樣子】，
  // 不是最完整的樣子——漏掉的欄位會退回預設，預設必須是最保守的那版。
  var CHARACTER_OVERRIDABLE = [
    'name',          // 角色名（大標）
    'title',         // 正式稱號
    'fullName',      // 完整稱呼
    'role',          // 角色定位 → IDENTITY
    'coreLine',      // 核心句 → CORE LINE
    'publicIntro',   // 公開介紹
    'publicDetail',  // 公開詳述 → 角色簡介本文
    'seal',          // 印記
    'poem'           // 詩號
  ];

  // 介紹欄位不固定格數。填幾格出現幾格，中間留空會被壓掉。
  var CHARACTER_INTRO_SLOTS = 6;

  /** 從冒險進度裡取出某個角色在目前階段的覆蓋內容 */
  function fieldsFor(adventureData, characterId) {
    var map = (adventureData && adventureData.characterContent) || {};
    return map[characterId] || {};
  }

  /**
   * 把階段覆蓋套用到角色物件上（就地修改，並回傳同一個物件）。
   *
   * 判斷「有沒有覆蓋」看的是那一列在不在，不是內容空不空。
   * 空內容是有意義的：「這個階段就是沒有正式稱號」跟
   * 「這個階段沒設定，沿用預設」是兩件不同的事。
   */
  function applyOverrides(char, fields) {
    if (!char) return char;
    var f = fields || {};

    var 有覆蓋 = function (fieldId) {
      return Object.prototype.hasOwnProperty.call(f, fieldId);
    };
    var value = function (fieldId) {
      return String((f[fieldId] && f[fieldId].value) || '').trim();
    };

    CHARACTER_OVERRIDABLE.forEach(function (key) {
      if (有覆蓋(key)) char[key] = value(key);
    });

    var intro = [];
    var 有介紹覆蓋 = false;
    for (var i = 1; i <= CHARACTER_INTRO_SLOTS; i++) {
      var tk = 'introField' + i + 'Title';
      var ck = 'introField' + i;
      if (!有覆蓋(tk) && !有覆蓋(ck)) continue;
      有介紹覆蓋 = true;
      var title = 有覆蓋(tk) ? value(tk) : '';
      var content = 有覆蓋(ck) ? value(ck) : '';
      if (title || content) intro.push({ title: title, value: content });
    }
    // 有覆蓋就整組換掉——包含「這個階段一格介紹欄都沒有」這種情況
    if (有介紹覆蓋) char.introFields = intro;

    return char;
  }

  /** 一次套用一整批角色 */
  function applyAll(chars, adventureData) {
    (chars || []).forEach(function (char) {
      applyOverrides(char, fieldsFor(adventureData, char && char.id));
    });
    return chars;
  }

  global.EndOfTimeCharacterFields = {
    CHARACTER_OVERRIDABLE: CHARACTER_OVERRIDABLE,
    CHARACTER_INTRO_SLOTS: CHARACTER_INTRO_SLOTS,
    fieldsFor: fieldsFor,
    applyOverrides: applyOverrides,
    applyAll: applyAll
  };
})(window);
