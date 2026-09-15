# MD 文件排版入門

> 給初學者的一頁式教學網站：3 個步驟，把普通 Markdown 整理成容易閱讀、容易維護的文件。

純 HTML / CSS / JavaScript：零 build、零 API、零外部依賴。整個資料夾放上 GitHub Pages 就能使用。

## 網站用途

- **Step 1～3 教學**：每一步都是「這一步要做什麼 → 簡短說明 → 範例 → 複製 → 完成後會得到什麼」
- **一鍵複製範例**：瀏覽器不支援剪貼簿 API 時，自動改用備援方法；都失敗時會幫你選取文字
- **下載完整範本**：`.md` 與 `.html` 兩種格式
- **5 項檢查清單**：進度條、完成提示，勾選紀錄存在瀏覽器（localStorage）
- **深色 / 淺色切換**：第一次跟隨系統設定，切換後會記住你的選擇
- **大字好讀**：內文 18px（手機 17px）、行高 1.8、正文最寬約 72ch
- **無障礙**：鍵盤可操作（清單支援空白鍵與 Enter）、螢幕報讀提示、尊重「減少動態效果」設定

## 檔案結構

```
.
├── index.html         # 頁面內容；<head> 內有深淺色初始化（避免先白一下再變黑）
├── styles.css         # 全部樣式；最上方是顏色與字級變數
├── app.js             # 功能：深淺色切換、複製、下載、檢查清單、章節導覽
├── templates.js       # 範本內容（資料層）：改範本只改這裡
├── README.md          # 本檔
├── .nojekyll          # 告訴 GitHub Pages 不用跑 Jekyll（沒上傳也能運作）
│
│   以下只用於開發測試，網站本身用不到
├── tests/
│   └── site.spec.mjs  # Playwright 驗收測試（114 項）
├── package.json       # 只記錄測試工具 @playwright/test
├── package-lock.json
└── .gitignore         # 排除 node_modules、測試結果
```

## 本機預覽

不要直接雙擊 `index.html`：`app.js` 用 ES module 載入 `templates.js`，多數瀏覽器會擋下 `file://` 的模組載入，範例會是空白（頁面上會出現提示）。

在這個資料夾開啟終端機，執行：

```bash
python -m http.server 8000
```

Windows 若顯示找不到 `python`，改用：

```bash
py -m http.server 8000
```

然後打開 <http://localhost:8000/>。要停止時按 `Ctrl + C`。

> Windows 若跳出防火牆詢問，可改用 `python -m http.server 8000 --bind 127.0.0.1`，只允許本機連線。

## 部署到 GitHub Pages

1. 在 GitHub 建立 repository `markdown-upgrade-guide`。免費帳號請選 **Public**，不要勾選自動建立 README。
2. 把本機 repo 推上去：

   ```bash
   git remote add origin https://github.com/rita112025-cpu/markdown-upgrade-guide.git
   git push -u origin main
   ```

3. 到 repository 的 **Settings → Pages**。
4. **Build and deployment → Source** 選 `Deploy from a branch`；Branch 選 `main`、資料夾選 `/ (root)`，按 **Save**。
5. 等 1～2 分鐘，網址會是 <https://rita112025-cpu.github.io/markdown-upgrade-guide/>。

GitHub Pages 直接發布 repo 裡的靜態檔案，不會執行 npm，也不需要 GitHub Actions。`tests/`、`package.json` 也會被一起發布，但網站不會用到它們。

所有資源都用相對路徑（`./styles.css`、`./app.js`、`./templates.js`），所以放在 `https://帳號.github.io/repository名稱/` 這種子路徑也能正常運作。

## 修改範本內容（templates.js）

`templates.js` 匯出 4 個常數：

| 常數 | 顯示在哪裡 |
| --- | --- |
| `STEP1_TEMPLATE` | Step 1 範例 |
| `STEP2_TEMPLATE` | Step 2 範例 |
| `STEP3_TEMPLATE` | Step 3 範例 |
| `FULL_TEMPLATE` | 完整範本、下載的 .md / .html |

- 直接修改反引號 `` ` `` 之間的文字即可，存檔後重新整理頁面。
- 範本裡要用反引號時，寫成 `` \` ``；出現 `${` 時，寫成 `\${`。
- `FULL_TEMPLATE` 由 Step 1～3 自動接起來，**不用另外修改**，也不會和各步驟內容不一致。
- 頁面上的說明文字（標題、「這一步要做什麼」、提示）在 `index.html`。

## 修改主題顏色（styles.css）

顏色全部是 CSS 變數，位於 `styles.css` 最上方：

- `:root { ... }`：淺色模式
- `:root[data-theme="dark"] { ... }`：深色模式

| 變數 | 用途 |
| --- | --- |
| `--bg` | 頁面背景 |
| `--bg-soft` | 滑過、次要背景 |
| `--surface` | 卡片背景 |
| `--text` / `--text-muted` | 主要文字 / 次要文字 |
| `--border` / `--border-strong` | 卡片框線 / 按鈕與程式碼框線 |
| `--brand` / `--brand-hover` | 品牌色（按鈕、進度條）/ 按鈕滑過 |
| `--brand-soft` | 品牌色淡底（目前章節、目標提示框） |
| `--brand-text` | 品牌色文字（連結、目前章節） |
| `--code-bg` / `--code-text` | 程式碼區塊 |

換品牌色時，請一起調整 `--brand-text`：文字和背景的對比至少要 4.5:1 才看得清楚，可用 [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) 檢查。

字級變數在同一個檔案的「字級與版面變數」：`--fs-body`（內文）、`--fs-h1`、`--fs-h2`、`--fs-code` 等。

## 自動測試（開發用）

改完網站後，重跑 114 項驗收測試，確認功能沒有壞掉。測試只在你的電腦執行，網站本身不需要這些工具。

需要 [Node.js](https://nodejs.org/) 20 以上。第一次執行：

```bash
npm ci
npx playwright install chromium
```

之後每次測試：

```bash
npm test
```

看到 `114 passed` 就是全部通過。

- **不用先開伺服器**：測試會自己啟動一個只用 Node 內建模組的小型伺服器，把網站放在 `/markdown-upgrade-guide/` 子路徑下，和 GitHub Pages 的網址結構相同；根目錄 `/` 一律回 404，用錯絕對路徑會直接失敗。
- **測試項目**：載入、深淺色切換、複製、下載、檢查清單、章節導覽、無障礙、減少動態效果、1440 / 768 / 390px 版面、Console 錯誤與外部請求、淺色與深色的文字對比度。
- **測別的網址**：設定 `BASE_URL`。例如先用 `python -m http.server 8000` 開本機預覽，再執行：
  - PowerShell：`$env:BASE_URL="http://127.0.0.1:8000/"; npm test`
  - cmd：`set "BASE_URL=http://127.0.0.1:8000/" && npm test`
  - macOS / Linux：`BASE_URL=http://127.0.0.1:8000/ npm test`
- **剪貼簿會被覆蓋**：複製功能的測試會寫入系統剪貼簿。
- **Windows 換行**：Windows 剪貼簿讀回時會把換行變成 CRLF，測試端會先轉回 LF 再比對；網站複製出去的內容沒有改。
- **截圖**：存在 `test-results/screenshots/`，只供人工檢視，不會進 Git。

## 零 API／零 build／零外部依賴

- 網站不需要 `npm install`，沒有 build 步驟，也不需要 GitHub Actions（`package.json` 只給上面的自動測試用）
- 不載入外部字型、CDN、追蹤碼，不呼叫任何 API
- 只在瀏覽器存兩個 localStorage 值，不會上傳：
  - `md-guide-theme`：深淺色選擇
  - `md-checklist-v2`：檢查清單勾選紀錄
- 頁尾的延伸閱讀是一般超連結，點了才會前往外部網站

## 關於 templates.js（如實說明）

原始 `upmd.me.zip` 沒有包含 `templates.js`，但 `app.js` 與原 README 都有引用它。壓縮檔、解壓縮資料夾都找不到原檔，也沒有 Git 紀錄可還原。

因此目前的 `templates.js` 是**重新撰寫**的：依照原頁面 Step 1（開頭架構）、Step 2（內容排版）、Step 3（收尾優化）的教學目的，寫成適合初學者的範例，**不是原始內容**。之後若找到原檔，直接覆蓋即可（請保留 4 個 export 名稱）。

## 來源與授權

- 內容、功能、教學流程：`upmd.me`（MD 文件升級範本）
- 視覺系統：`vitepress-kit-clean` 的 `DESIGN.md`（單一強調色 #5E6AD2、邊框分層、8px 圓角、系統字體）；本站沒有使用 VitePress
- 授權：MIT，可自由修改、商用
