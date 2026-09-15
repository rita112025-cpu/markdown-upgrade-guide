// templates.js — 範本內容（資料層）。要改範本，只改這個檔案。
//
// 注意：本檔為「重新建立」。
// 原始 upmd.me.zip 沒有包含 templates.js，也找不到原檔；
// 以下內容依 index.html 中 Step 1～3 的教學目的重新撰寫，不是原始內容。
//
// 編輯規則：
// - 範本寫在反引號 ` 之間；範本裡要用反引號時，寫成 \`
// - 範本裡如果出現 ${ ，寫成 \${
// - FULL_TEMPLATE 由 Step 1～3 自動組合，不需要另外維護

// Step 1｜開頭架構：標題、一句話用途、基本資訊、目錄
export const STEP1_TEMPLATE = `# 專案名稱

> 一句話說明這份文件的用途，例如：記錄網站的下載與使用方式。

| 項目 | 內容 |
| --- | --- |
| 👤 維護者 | @你的帳號 |
| 📅 最後更新 | 2026-09-15 |
| 🟢 狀態 | 使用中 |

## 目錄

- [快速開始](#快速開始)
- [檔案說明](#檔案說明)
- [常見問題](#常見問題)
- [更新紀錄](#更新紀錄)
- [參考資源](#參考資源)`;

// Step 2｜內容排版：編號步驟、表格、提示框、小標題
export const STEP2_TEMPLATE = `## 快速開始

> [!TIP]
> 3 個步驟就能開始，細節寫在後面的段落。

1. 點 GitHub 專案頁面上綠色的 \`Code\` 按鈕
2. 選 \`Download ZIP\` 下載
3. 解壓縮後，打開 \`index.html\`

## 檔案說明

| 檔案 | 用途 |
| --- | --- |
| \`index.html\` | 網站首頁 |
| \`README.md\` | 專案說明（就是這份文件） |

> [!WARNING]
> 修改前**先備份**，改壞了才找得回原本的內容。

## 常見問題

### 表格沒有變成表格？

第二行一定要有 \`| --- |\` 分隔線，表格前後各空一行最保險。

### 換行沒有效果？

要**空一行**才會分段；只按一次 Enter，通常會接在同一段。`;

// Step 3｜收尾優化：分隔線、更新紀錄、參考資源、回到頂部
export const STEP3_TEMPLATE = `---

## 更新紀錄

| 日期 | 版本 | 改了什麼 |
| --- | --- | --- |
| 2026-09-15 | v1.1 | 新增常見問題 |
| 2026-09-01 | v1.0 | 第一版 |

## 參考資源

- [GitHub 官方：基本寫作和格式語法](https://docs.github.com/zh/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
- 有問題或想補充，歡迎到本專案的 Issues 留言

[回到頂部 ↑](#專案名稱)`;

// 完整範本 = Step 1 + Step 2 + Step 3（中間空一行），內容永遠和三個步驟一致
export const FULL_TEMPLATE = [STEP1_TEMPLATE, STEP2_TEMPLATE, STEP3_TEMPLATE].join('\n\n');
