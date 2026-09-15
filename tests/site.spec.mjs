// tests/site.spec.mjs — 網站驗收測試，共 114 項。
//
// 執行：npm test
// 測別的網址：設定環境變數 BASE_URL，例如 BASE_URL=http://127.0.0.1:8000/
//
// 沒設定 BASE_URL 時，測試會自己啟動一個只用 Node 內建模組的靜態伺服器，
// 把專案放在 /markdown-upgrade-guide/ 子路徑底下（和 GitHub Pages project site 相同），
// 根目錄 / 一律回 404，所以只要有資源用了 /styles.css 這種絕對路徑，就會被抓出來。
//
// 注意：複製功能的測試會寫入系統剪貼簿。

import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const REPO_NAME = 'markdown-upgrade-guide';
const INDEX_FILE_URL = new URL('../index.html', import.meta.url).href;

const TEMPLATE_KEYS = [
  ['step1', 'Step 1 範例'],
  ['step2', 'Step 2 範例'],
  ['step3', 'Step 3 範例'],
  ['full', '完整範本'],
];

// ---------- 測試用靜態伺服器 ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function startStaticServer() {
  const prefix = `/${REPO_NAME}/`;
  const server = http.createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === `/${REPO_NAME}`) {
      res.writeHead(301, { Location: prefix });
      res.end();
      return;
    }
    if (!pathname.startsWith(prefix)) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    let rel;
    try {
      rel = decodeURIComponent(pathname.slice(prefix.length));
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function normalizeBaseUrl(value) {
  const url = new URL(value.trim());
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

let BASE = process.env.BASE_URL ? normalizeBaseUrl(process.env.BASE_URL) : '';
let server = null;

test.beforeAll(async () => {
  if (BASE) return;
  server = await startStaticServer();
  BASE = `http://127.0.0.1:${server.address().port}/${REPO_NAME}/`;
});

test.afterAll(async () => {
  if (!server) return;
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  server = null;
});

// ---------- 共用工具 ----------

// 所有 http 頁面的 console 錯誤與網路請求，最後在「網路」群組一起檢查
const NET = { consoleErrors: [], requests: [], responses: [], bad: [] };

async function newTrackedPage(context) {
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') NET.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => NET.consoleErrors.push(`pageerror: ${err.message}`));
  page.on('request', (req) => NET.requests.push(req.url()));
  page.on('response', (res) => {
    NET.responses.push(`${res.status()} ${res.url()}`);
    if (res.status() >= 400) NET.bad.push(`${res.status()} ${res.url()}`);
  });
  page.on('requestfailed', (req) => NET.bad.push(`FAILED ${req.url()} ${req.failure()?.errorText}`));
  return page;
}

async function openSite(context, page) {
  const target = page || (await newTrackedPage(context));
  const response = await target.goto(BASE, { waitUntil: 'load' });
  await target.waitForFunction(() => document.documentElement.dataset.appReady === 'true', null, { timeout: 5000 });
  return { page: target, response };
}

// 讀取頁面實際載入的 templates.js（同一個模組實例）
const readTemplates = (page) =>
  page.evaluate(async () => {
    const m = await import(new URL('./templates.js', location.href).href);
    return { step1: m.STEP1_TEMPLATE, step2: m.STEP2_TEMPLATE, step3: m.STEP3_TEMPLATE, full: m.FULL_TEMPLATE };
  });

// Windows 系統剪貼簿讀回時會把 \n 轉成 \r\n（直接 writeText→readText 也一樣）。
// 只在測試端還原後比對，網站輸出維持 \n，不為了測試修改。
const lf = (text) => text.replace(/\r\n/g, '\n');

function screenshotPath(testInfo, name) {
  return path.join(testInfo.project.outputDir, 'screenshots', `${name}.png`);
}

async function waitForTheme(page, theme) {
  await page.waitForFunction((t) => document.documentElement.getAttribute('data-theme') === t, theme);
}

// 記錄 <link rel=stylesheet> 出現在 DOM 時的 data-theme，確認主題在 CSS 之前就設定好
function themeProbe() {
  window.__themeAtStylesheet = 'not-seen';
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeName === 'LINK' && node.rel === 'stylesheet' && window.__themeAtStylesheet === 'not-seen') {
          window.__themeAtStylesheet = document.documentElement.getAttribute('data-theme');
        }
      }
    }
  }).observe(document, { childList: true, subtree: true });
}

const themeState = (page) =>
  page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    stored: localStorage.getItem('md-guide-theme'),
    meta: document.querySelector('meta[name="theme-color"]').content,
    label: document.getElementById('theme-toggle').innerText.replace(/\s+/g, ''),
    atCss: window.__themeAtStylesheet,
  }));

// ================================================================
// 1. 載入（10）
// ================================================================
test.describe('載入', () => {
  test.describe.configure({ mode: 'serial' });
  let context;
  let page;
  let response;
  let tpl;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    ({ page, response } = await openSite(context));
    tpl = await readTemplates(page);
  });
  test.afterAll(async () => context?.close());

  test('首頁回應 200', async () => {
    expect(response.status(), response.url()).toBe(200);
  });

  test('app.js 初始化完成', async () => {
    expect(await page.evaluate(() => document.documentElement.dataset.appReady)).toBe('true');
  });

  test('「範例沒有載入」提示保持隱藏', async () => {
    await expect(page.locator('#app-fallback')).toBeHidden();
  });

  test('templates.js 回應 200', async () => {
    const entry = NET.responses.find((r) => r.includes('/templates.js'));
    expect(entry, 'templates.js 應該被載入').toBeTruthy();
    expect(entry.startsWith('200 '), entry).toBe(true);
  });

  for (const [key, name] of TEMPLATE_KEYS) {
    test(`畫面上的${name} = templates.js`, async () => {
      expect(await page.textContent(`#code-${key}`)).toBe(tpl[key]);
    });
  }

  test('完整範本行數顯示正確', async () => {
    await expect(page.locator('#full-line-count')).toHaveText(String(tpl.full.split('\n').length));
  });

  test('file:// 直接開啟時，顯示「請用本機伺服器」提示', async () => {
    const filePage = await context.newPage(); // 不追蹤：file:// 載入模組本來就會有 CORS 錯誤
    await filePage.goto(INDEX_FILE_URL, { waitUntil: 'load' });
    await expect(filePage.locator('#app-fallback')).toBeVisible();
    expect(await filePage.evaluate(() => document.documentElement.dataset.appReady || null)).toBeNull();
    await filePage.close();
  });
});

// ================================================================
// 2. 主題（12）
// ================================================================
test.describe('主題', () => {
  test.describe('系統為淺色', () => {
    test.describe.configure({ mode: 'serial' });
    let context;
    let page;

    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
      page = await newTrackedPage(context);
      await page.addInitScript(themeProbe);
      await openSite(context, page);
    });
    test.afterAll(async () => context?.close());

    test('初次載入尊重系統設定（淺色）', async () => {
      const t = await themeState(page);
      expect(t, JSON.stringify(t)).toMatchObject({ theme: 'light', bg: 'rgb(255, 255, 255)', stored: null });
    });

    test('CSS 載入前已設定 data-theme（不閃白）', async () => {
      expect((await themeState(page)).atCss).toBe('light');
    });

    test('淺色時按鈕寫「切換成深色模式」', async () => {
      expect((await themeState(page)).label).toBe('切換成深色模式');
    });

    test('淺色 → 深色', async () => {
      await page.click('#theme-toggle');
      const t = await themeState(page);
      expect(t, JSON.stringify(t)).toMatchObject({ theme: 'dark', bg: 'rgb(10, 10, 10)', stored: 'dark' });
    });

    test('theme-color 跟著變成 #0A0A0A', async () => {
      expect((await themeState(page)).meta.toUpperCase()).toBe('#0A0A0A');
    });

    test('深色時按鈕寫「切換成淺色模式」', async () => {
      expect((await themeState(page)).label).toBe('切換成淺色模式');
    });

    test('重新整理後保留深色', async () => {
      await page.reload({ waitUntil: 'load' });
      const t = await themeState(page);
      expect(t, JSON.stringify(t)).toMatchObject({ theme: 'dark', bg: 'rgb(10, 10, 10)', atCss: 'dark' });
    });

    test('深色 → 淺色（鍵盤 Enter）', async () => {
      await page.focus('#theme-toggle');
      await page.keyboard.press('Enter');
      const t = await themeState(page);
      expect(t, JSON.stringify(t)).toMatchObject({ theme: 'light', stored: 'light' });
    });

    test('重新整理後保留淺色', async () => {
      await page.reload({ waitUntil: 'load' });
      const t = await themeState(page);
      expect(t, JSON.stringify(t)).toMatchObject({ theme: 'light', bg: 'rgb(255, 255, 255)', atCss: 'light' });
    });
  });

  test.describe('系統為深色', () => {
    test.describe.configure({ mode: 'serial' });
    let context;
    let page;

    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
      page = await newTrackedPage(context);
      await page.addInitScript(themeProbe);
      await openSite(context, page);
    });
    test.afterAll(async () => context?.close());

    test('初次載入尊重系統設定（深色），CSS 載入前已是深色', async () => {
      const t = await themeState(page);
      expect(t, JSON.stringify(t)).toMatchObject({ theme: 'dark', bg: 'rgb(10, 10, 10)', atCss: 'dark' });
    });

    test('還沒手動選擇：系統改淺色，網站即時跟著變', async () => {
      await page.emulateMedia({ colorScheme: 'light' });
      await expect.poll(async () => (await themeState(page)).theme).toBe('light');
    });

    test('手動選擇後，不被系統設定覆蓋', async () => {
      await page.click('#theme-toggle');
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.emulateMedia({ colorScheme: 'light' });
      await page.waitForTimeout(150);
      const t = await themeState(page);
      expect(t, JSON.stringify(t)).toMatchObject({ theme: 'dark', stored: 'dark' });
    });
  });
});

// ================================================================
// 3. 複製（13）
// ================================================================
test.describe('複製', () => {
  test.describe.configure({ mode: 'serial' });
  let context;
  let page;
  let tpl;

  const readClipboard = () => page.evaluate(() => navigator.clipboard.readText());
  const clearClipboard = () => page.evaluate(() => navigator.clipboard.writeText('__empty__'));

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'light',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    ({ page } = await openSite(context));
    await page.bringToFront();
    tpl = await readTemplates(page);
  });
  test.afterAll(async () => context?.close());

  for (const [key, name] of TEMPLATE_KEYS) {
    test(`複製${name}：剪貼簿內容正確`, async () => {
      await clearClipboard();
      await page.locator(`[data-copy="${key}"]`).click();
      await expect.poll(async () => lf(await readClipboard())).toBe(tpl[key]);
    });

    test(`複製${name}：按鈕顯示「✓ 已複製」`, async () => {
      await expect(page.locator(`[data-copy="${key}"]`)).toHaveText('✓ 已複製');
    });
  }

  test('live region 報讀複製結果', async () => {
    await expect(page.locator('#live-region')).toHaveText('已複製完整範本到剪貼簿');
  });

  test('2 秒後按鈕文字還原', async () => {
    await expect(page.locator('[data-copy="step1"]')).toHaveText('複製 Step 1 範例', { timeout: 4000 });
  });

  test('Clipboard API 失敗 → execCommand 備援成功', async () => {
    await clearClipboard();
    await page.evaluate(() => {
      window.__execCalls = 0;
      const original = document.execCommand.bind(document);
      document.execCommand = (cmd, ...rest) => {
        if (cmd === 'copy') window.__execCalls += 1;
        return original(cmd, ...rest);
      };
      navigator.clipboard.writeText = () => Promise.reject(new Error('blocked for test'));
    });
    await page.locator('[data-copy="step2"]').click();
    await expect.poll(async () => lf(await readClipboard())).toBe(tpl.step2);
    expect(await page.evaluate(() => window.__execCalls)).toBe(1);
  });

  test('備援複製後焦點回到按鈕', async () => {
    expect(await page.evaluate(() => document.activeElement?.dataset?.copy)).toBe('step2');
  });

  test('兩種方法都失敗 → 自動選取範例文字', async () => {
    await page.evaluate(() => {
      document.execCommand = () => false;
    });
    const button = page.locator('[data-copy="step3"]');
    await button.click();
    await expect(button).toContainText('複製失敗');
    expect(await page.evaluate(() => window.getSelection().toString())).toBe(tpl.step3);
  });
});

// ================================================================
// 4. 下載（5）
// ================================================================
test.describe('下載', () => {
  test.describe.configure({ mode: 'serial' });
  let context;
  let page;
  let tpl;
  let mdDownload;
  let htmlDownload;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', acceptDownloads: true });
    ({ page } = await openSite(context));
    tpl = await readTemplates(page);
  });
  test.afterAll(async () => context?.close());

  test('下載 .md：檔名為 md-upgrade-full-template.md', async () => {
    [mdDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#full [data-download="md"]').click()]);
    expect(mdDownload.suggestedFilename()).toBe('md-upgrade-full-template.md');
  });

  test('下載 .md：內容 = 完整範本（無 BOM）', async () => {
    const body = fs.readFileSync(await mdDownload.path(), 'utf8');
    expect(body.charCodeAt(0)).not.toBe(0xfeff);
    expect(body).toBe(`${tpl.full}\n`);
  });

  test('下載 .html：檔名為 md-upgrade-guide.html', async () => {
    [htmlDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#full [data-download="html"]').click()]);
    expect(htmlDownload.suggestedFilename()).toBe('md-upgrade-guide.html');
  });

  test('下載 .html：完整 HTML5，<pre> 內容 = 完整範本', async () => {
    const body = fs.readFileSync(await htmlDownload.path(), 'utf8');
    expect(body.startsWith('<!DOCTYPE html>')).toBe(true);
    const viewer = await context.newPage();
    await viewer.setContent(body);
    expect((await viewer.title()).length).toBeGreaterThan(0);
    expect(await viewer.textContent('pre')).toBe(tpl.full);
    await viewer.close();
  });

  test('Hero 的「下載完整範本 .md」可下載', async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#start [data-download="md"]').click()]);
    expect(download.suggestedFilename()).toBe('md-upgrade-full-template.md');
  });
});

// ================================================================
// 5. 檢查清單（9）
// ================================================================
test.describe('檢查清單', () => {
  test.describe.configure({ mode: 'serial' });
  let context;
  let page;

  const listState = () =>
    page.evaluate(() => ({
      checked: [...document.querySelectorAll('.check-input')].map((i) => i.checked).join(','),
      stored: localStorage.getItem('md-checklist-v2'),
      count: document.querySelector('.progress-text [data-progress-count]').textContent,
      side: document.querySelector('.nav-count').textContent,
      width: document.querySelector('#checklist-progress .progress-fill').style.width,
      now: document.getElementById('checklist-progress').getAttribute('aria-valuenow'),
      celebrate: !document.getElementById('celebrate').hidden,
      itemClass: [...document.querySelectorAll('.check-item')].map((l) => l.classList.contains('is-checked')).join(','),
    }));

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    ({ page } = await openSite(context));
  });
  test.afterAll(async () => context?.close());

  test('滑鼠點擊可勾選，進度同步（清單、目錄、aria）', async () => {
    await page.locator('.check-item').nth(0).click();
    await page.locator('.check-item').nth(2).click();
    const c = await listState();
    expect(c, JSON.stringify(c)).toMatchObject({
      checked: 'true,false,true,false,false',
      count: '2/5',
      side: '2/5',
      now: '2',
      width: '40%',
      itemClass: 'true,false,true,false,false',
    });
  });

  test('localStorage 寫入 [0,2]', async () => {
    expect((await listState()).stored).toBe('[0,2]');
  });

  test('重新整理後勾選狀態保留', async () => {
    await page.reload({ waitUntil: 'load' });
    const c = await listState();
    expect(c, JSON.stringify(c)).toMatchObject({ checked: 'true,false,true,false,false', count: '2/5' });
  });

  test('鍵盤 Space 勾選', async () => {
    await page.locator('.check-input').nth(1).focus();
    await page.keyboard.press('Space');
    expect((await listState()).checked.split(',')[1]).toBe('true');
  });

  test('鍵盤 Enter 勾選', async () => {
    await page.locator('.check-input').nth(3).focus();
    await page.keyboard.press('Enter');
    expect((await listState()).checked.split(',')[3]).toBe('true');
  });

  test('鍵盤 Enter 取消勾選', async () => {
    await page.keyboard.press('Enter');
    expect((await listState()).checked.split(',')[3]).toBe('false');
  });

  test('Tab 聚焦時勾選框有焦點框', async () => {
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const el = document.activeElement;
      return el.classList.contains('check-input') ? getComputedStyle(el.nextElementSibling).outlineStyle : `focus on ${el.className}`;
    });
    expect(ring).toBe('solid');
  });

  test('全部 5 項完成：顯示完成提示、進度 100%', async ({}, testInfo) => {
    await page.locator('.check-item').nth(3).click();
    await page.locator('.check-item').nth(4).click();
    const c = await listState();
    expect(c, JSON.stringify(c)).toMatchObject({ count: '5/5', width: '100%', celebrate: true });
    await page.locator('#celebrate').scrollIntoViewIfNeeded();
    await page.screenshot({ path: screenshotPath(testInfo, 'd1440-light-checklist-done') });
  });

  test('「清除勾選」回到 0/5', async () => {
    await page.click('#checklist-reset');
    const c = await listState();
    expect(c, JSON.stringify(c)).toMatchObject({ count: '0/5', celebrate: false, stored: '[]' });
  });
});

// ================================================================
// 6. 章節導覽（2）
// ================================================================
test.describe('章節導覽', () => {
  test.describe.configure({ mode: 'serial' });
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', reducedMotion: 'no-preference' });
    ({ page } = await openSite(context));
  });
  test.afterAll(async () => context?.close());

  test('捲到 Step 2 時目錄高亮 Step 2（IntersectionObserver）', async () => {
    await page.evaluate(() => document.getElementById('step2').scrollIntoView({ behavior: 'instant' }));
    await expect
      .poll(() => page.evaluate(() => document.querySelector('.nav-link[aria-current="true"]')?.dataset.nav))
      .toBe('step2');
  });

  test('點目錄跳到檢查清單，標題不被頂部擋住', async () => {
    await page.click('.nav-link[data-nav="checklist"]');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const top = Math.round(document.getElementById('checklist').getBoundingClientRect().top);
          const active = document.querySelector('.nav-link[aria-current="true"]')?.dataset.nav;
          return location.hash === '#checklist' && top >= 64 && top <= 120 && active === 'checklist';
        }),
      )
      .toBe(true);
  });
});

// ================================================================
// 7. 無障礙（3）
// ================================================================
test.describe('無障礙', () => {
  test.describe.configure({ mode: 'serial' });
  let context;
  let page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    ({ page } = await openSite(context));
  });
  test.afterAll(async () => context?.close());

  test('第一個 Tab 是「跳到主要內容」且看得到', async () => {
    await page.keyboard.press('Tab');
    const skip = await page.evaluate(() => ({
      cls: document.activeElement.className,
      top: Math.round(document.activeElement.getBoundingClientRect().top),
    }));
    expect(skip.cls).toBe('skip-link');
    expect(skip.top).toBeGreaterThanOrEqual(0);
  });

  test('按 Enter 後焦點移到主要內容', async () => {
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('main');
  });

  test('lang、單一 h1、按鈕都有名稱、live region、nav 標籤', async () => {
    const a11y = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      h1: document.querySelectorAll('h1').length,
      unnamedButtons: [...document.querySelectorAll('button')].filter((b) => !b.innerText.trim()).length,
      liveRegion: document.getElementById('live-region').getAttribute('aria-live'),
      navLabel: document.querySelector('nav').getAttribute('aria-label'),
    }));
    expect(a11y).toEqual({ lang: 'zh-TW', h1: 1, unnamedButtons: 0, liveRegion: 'polite', navLabel: '章節導覽' });
  });
});

// ================================================================
// 8. 動態效果（3）
// ================================================================
const motionState = (page) =>
  page.evaluate(() => {
    const el = document.getElementById('celebrate');
    el.hidden = false;
    const anim = getComputedStyle(el).animationName;
    el.hidden = true;
    return {
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
      anim,
      transition: getComputedStyle(document.querySelector('.btn')).transitionDuration,
    };
  });

test.describe('動態效果', () => {
  test('一般設定：平滑捲動、淡入動畫、transition', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const { page } = await openSite(context);
    const m = await motionState(page);
    expect(m.scroll).toBe('smooth');
    expect(m.anim).toBe('fade-in');
    expect(m.transition).not.toBe('0s');
    await context.close();
  });

  test.describe('減少動態效果', () => {
    test.describe.configure({ mode: 'serial' });
    let context;
    let page;

    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
        isMobile: true,
        hasTouch: true,
      });
      page = await newTrackedPage(context);
      // 記錄章節列 scrollTo 使用的 behavior
      await page.addInitScript(() => {
        window.__navScrollBehaviors = [];
        const original = Element.prototype.scrollTo;
        Element.prototype.scrollTo = function (...args) {
          if (this.classList?.contains('nav-list')) window.__navScrollBehaviors.push(args[0]?.behavior);
          return original.apply(this, args);
        };
      });
      await openSite(context, page);
    });
    test.afterAll(async () => context?.close());

    test('prefers-reduced-motion：沒有平滑捲動、動畫、transition', async () => {
      expect(await motionState(page)).toEqual({ scroll: 'auto', anim: 'none', transition: '0s' });
    });

    test('prefers-reduced-motion：手機章節列直接跳到目前章節（不滑動）', async () => {
      await page.evaluate(() => document.getElementById('checklist').scrollIntoView({ behavior: 'instant' }));
      await expect.poll(() => page.evaluate(() => document.querySelector('.nav-list').scrollLeft)).toBeGreaterThan(0);
      const behaviors = await page.evaluate(() => window.__navScrollBehaviors);
      expect(behaviors.length).toBeGreaterThan(0);
      expect(behaviors.every((b) => b === 'auto'), JSON.stringify(behaviors)).toBe(true);
    });
  });
});

// ================================================================
// 9～11. 版面：1440 / 768 / 390（8 + 9 + 9）
// ================================================================
async function layoutMetrics(page) {
  return page.evaluate(() => {
    const px = (el, prop) => parseFloat(getComputedStyle(el)[prop]);
    const vw = document.documentElement.clientWidth;
    const smallTargets = [...document.querySelectorAll('.btn, .nav-link, .theme-toggle, .check-item, .code-details > summary, .brand')]
      .filter((el) => el.getClientRects().length && el.getBoundingClientRect().height < 44)
      .map((el) => `${el.className}:${Math.round(el.getBoundingClientRect().height)}`);
    const offenders = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || r.right <= vw + 1 || el.closest('.sr-only')) return;
      let a = el.parentElement;
      let clipped = false;
      while (a && a !== document.body) {
        const ox = getComputedStyle(a).overflowX;
        if (ox === 'auto' || ox === 'hidden' || ox === 'scroll') {
          clipped = true;
          break;
        }
        a = a.parentElement;
      }
      if (!clipped) offenders.push(`${el.tagName}.${el.className}`);
    });
    let minFs = 99;
    let minEl = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el.getClientRects().length || el.closest('.sr-only, [hidden], .skip-link, script')) continue;
      const fs = px(el, 'fontSize');
      if (fs < minFs) {
        minFs = fs;
        minEl = `${el.tagName}.${el.className} "${n.textContent.trim().slice(0, 16)}"`;
      }
    }
    const pre = document.querySelector('#code-step2').parentElement;
    const para = document.querySelector('#step1 > p:not(.step-meta)');
    return {
      vw,
      scrollW: document.documentElement.scrollWidth,
      bodyFs: px(document.body, 'fontSize'),
      lineHeight: Math.round((px(document.body, 'lineHeight') / px(document.body, 'fontSize')) * 100) / 100,
      h1: Math.round(px(document.querySelector('h1'), 'fontSize') * 10) / 10,
      h2: Math.round(px(document.querySelector('#step1 h2'), 'fontSize') * 10) / 10,
      code: px(pre, 'fontSize'),
      hint: px(document.querySelector('.hint'), 'fontSize'),
      paraW: Math.round(para.getBoundingClientRect().width),
      preOverflowX: getComputedStyle(pre).overflowX,
      preWhiteSpace: getComputedStyle(pre).whiteSpace,
      navDir: getComputedStyle(document.querySelector('.nav-list')).flexDirection,
      sidebarVisible: getComputedStyle(document.querySelector('.sidebar-card')).display !== 'none',
      smallTargets,
      offenders: offenders.slice(0, 8),
      minFs,
      minEl,
    };
  });
}

const VIEWPORTS = [
  { label: 'd1440', width: 1440, height: 900, mobile: false },
  { label: 't768', width: 768, height: 1024, mobile: false },
  { label: 'm390', width: 390, height: 844, mobile: true },
];

for (const vp of VIEWPORTS) {
  test.describe(`版面 ${vp.width}px`, () => {
    test.describe.configure({ mode: 'serial' });
    let context;
    let page;
    let m;

    test.beforeAll(async ({ browser }, testInfo) => {
      context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: 'light',
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
      });
      ({ page } = await openSite(context));
      m = await layoutMetrics(page);
      // 截圖只供人工檢視，存在 test-results/screenshots/（不進 Git）
      await page.screenshot({ path: screenshotPath(testInfo, `${vp.label}-light-top`) });
      await page.emulateMedia({ colorScheme: 'dark' });
      await waitForTheme(page, 'dark');
      await page.screenshot({ path: screenshotPath(testInfo, `${vp.label}-dark-top`) });
      await page.emulateMedia({ colorScheme: 'light' });
      await waitForTheme(page, 'light');
    });
    test.afterAll(async () => context?.close());

    test('沒有水平爆版', async () => {
      expect(m.scrollW, `scrollWidth=${m.scrollW} vw=${m.vw}`).toBeLessThanOrEqual(m.vw);
      expect(m.offenders).toEqual([]);
    });

    test('內文字級與行高', async () => {
      if (vp.width >= 768) expect(m.bodyFs).toBe(18);
      else expect(m.bodyFs).toBeGreaterThanOrEqual(16);
      expect(m.lineHeight).toBeGreaterThanOrEqual(1.75);
      expect(m.lineHeight).toBeLessThanOrEqual(1.85);
    });

    test('H1 與 H2 字級', async () => {
      const [min, max] = vp.width >= 768 ? [36, 44] : [30, 34];
      expect(m.h1).toBeGreaterThanOrEqual(min);
      expect(m.h1).toBeLessThanOrEqual(max);
      expect(m.h2).toBeGreaterThanOrEqual(26);
      expect(m.h2).toBeLessThanOrEqual(30);
    });

    test('程式碼、提示與最小字級', async () => {
      expect(m.code).toBeGreaterThanOrEqual(14);
      expect(m.code).toBeLessThanOrEqual(15);
      expect(m.hint).toBeGreaterThanOrEqual(13);
      expect(m.minFs, m.minEl).toBeGreaterThanOrEqual(13);
    });

    test('正文寬度不超過 72ch（≤ 800px）', async () => {
      expect(m.paraW).toBeLessThanOrEqual(800);
    });

    test('可點擊元素高度 ≥ 44px', async () => {
      expect(m.smallTargets).toEqual([]);
    });

    test('程式碼區塊可水平捲動（white-space: pre）', async () => {
      expect(m.preOverflowX).toBe('auto');
      expect(m.preWhiteSpace).toBe('pre');
    });

    if (vp.width < 1024) {
      test('側欄收起，改成頂部橫向章節列', async () => {
        expect(m.navDir).toBe('row');
        expect(m.sidebarVisible).toBe(false);
      });

      test('章節列固定在頂部，並自動捲到目前章節', async ({}, testInfo) => {
        await page.evaluate(() => document.getElementById('step2').scrollIntoView({ behavior: 'instant' }));
        await page.evaluate(() => document.getElementById('checklist').scrollIntoView({ behavior: 'instant' }));
        await expect
          .poll(() =>
            page.evaluate(() => {
              const list = document.querySelector('.nav-list');
              const a = list.querySelector('[aria-current="true"]');
              if (!a) return null;
              const lr = list.getBoundingClientRect();
              const ar = a.getBoundingClientRect();
              return {
                active: a.dataset.nav,
                inView: ar.left >= lr.left - 1 && ar.right <= lr.right + 1,
                stickyTop: Math.round(document.querySelector('.sidebar').getBoundingClientRect().top),
              };
            }),
          )
          .toEqual({ active: 'checklist', inView: true, stickyTop: 0 });
        await page.screenshot({ path: screenshotPath(testInfo, `${vp.label}-light-checklist`) });
      });
    } else {
      test('左側目錄 + 進度卡', async () => {
        expect(m.navDir).toBe('column');
        expect(m.sidebarVisible).toBe(true);
      });
    }
  });
}

// ================================================================
// 12. 網路（3）
// ================================================================
test.describe('網路', () => {
  test.beforeAll(async ({ browser }) => {
    // 單獨執行這一組時也要有資料：至少重新載入一次首頁
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await openSite(context);
    await context.close();
  });

  test('Console 0 error（所有 http 頁面）', async () => {
    expect(NET.consoleErrors).toEqual([]);
  });

  test('沒有 404 或載入失敗', async () => {
    expect(NET.responses.length).toBeGreaterThan(0);
    expect(NET.bad).toEqual([]);
  });

  test('沒有外部字型、CDN、API 請求', async () => {
    const origin = new URL(BASE).origin;
    const external = [...new Set(NET.requests)].filter(
      (u) => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:'),
    );
    expect(external).toEqual([]);
  });
});

// ================================================================
// 13. 對比度（淺色 14 + 深色 14）
// ================================================================
// [名稱, 前景變數, 背景變數, 最低對比]；半透明顏色先疊在 --bg 上再計算
const CONTRAST_PAIRS = [
  ['內文 text / bg', '--text', '--bg', 4.5],
  ['內文 text / surface', '--text', '--surface', 4.5],
  ['內文 text / brand-soft（勾選後、目標框）', '--text', '--brand-soft', 4.5],
  ['次要 text-muted / bg', '--text-muted', '--bg', 4.5],
  ['次要 text-muted / surface', '--text-muted', '--surface', 4.5],
  ['次要 text-muted / bg-soft', '--text-muted', '--bg-soft', 4.5],
  ['連結 brand-text / bg', '--brand-text', '--bg', 4.5],
  ['目前章節 brand-text / brand-soft', '--brand-text', '--brand-soft', 4.5],
  ['按鈕字 on-brand / brand', '--on-brand', '--brand', 4.5],
  ['按鈕字 on-brand / brand-hover', '--on-brand', '--brand-hover', 4.5],
  ['程式碼 code-text / code-bg', '--code-text', '--code-bg', 4.5],
  ['勾選框邊 text-muted / surface（元件）', '--text-muted', '--surface', 3],
  ['焦點框 brand-text / bg（元件）', '--brand-text', '--bg', 3],
  ['進度條 brand / bg-soft（元件）', '--brand', '--bg-soft', 3],
];

function contrastRatios(page, pairs) {
  return page.evaluate((list) => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const toRgba = (value) => {
      probe.style.color = '';
      probe.style.color = value;
      const n = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
      return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
    };
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
    });
    const lum = (c) => {
      const f = (x) => {
        const v = x / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const bg = { ...toRgba(css('--bg')), a: 1 };
    const color = (name) => over(toRgba(css(name)), bg);
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const result = list.map(([, fg, back]) => Math.round(ratio(color(fg), color(back)) * 100) / 100);
    probe.remove();
    return result;
  }, pairs);
}

test.describe('對比度', () => {
  test.describe.configure({ mode: 'serial' });
  const ratios = {};

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    const { page } = await openSite(context);
    ratios.light = await contrastRatios(page, CONTRAST_PAIRS);
    await page.click('#theme-toggle');
    await waitForTheme(page, 'dark');
    ratios.dark = await contrastRatios(page, CONTRAST_PAIRS);
    await context.close();
  });

  for (const [scheme, label] of [['light', '淺色'], ['dark', '深色']]) {
    CONTRAST_PAIRS.forEach(([name, , , min], index) => {
      test(`${label}：${name} ≥ ${min}:1`, async () => {
        const value = ratios[scheme][index];
        expect(value, `${value}:1`).toBeGreaterThanOrEqual(min);
      });
    });
  }
});
