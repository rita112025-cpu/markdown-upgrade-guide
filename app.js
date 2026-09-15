// app.js — 零依賴 Vanilla JS（ES module）
// 功能：深淺色切換、顯示範本、複製、下載、檢查清單、章節導覽
import { STEP1_TEMPLATE, STEP2_TEMPLATE, STEP3_TEMPLATE, FULL_TEMPLATE } from './templates.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const TEMPLATES = {
  step1: { text: STEP1_TEMPLATE, name: 'Step 1 範例' },
  step2: { text: STEP2_TEMPLATE, name: 'Step 2 範例' },
  step3: { text: STEP3_TEMPLATE, name: 'Step 3 範例' },
  full: { text: FULL_TEMPLATE, name: '完整範本' },
};

const THEME_KEY = 'md-guide-theme';   // 要和 index.html <head> 內的初始化腳本一致
const CHECK_KEY = 'md-checklist-v2';  // 沿用原版 key，舊的勾選紀錄可以接續使用
const MD_FILENAME = 'md-upgrade-full-template.md';
const HTML_FILENAME = 'md-upgrade-guide.html';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---------- 小工具 ----------

// localStorage 可能被瀏覽器封鎖（無痕模式、隱私設定）；失敗時只是不會記住，不影響其他功能
const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // 忽略
    }
  },
};

let announceTimer = 0;
function announce(message) {
  const region = $('#live-region');
  if (!region) return;
  region.textContent = '';
  window.clearTimeout(announceTimer);
  // 先清空再寫入：同一句話連續出現時，螢幕報讀器才會再念一次
  announceTimer = window.setTimeout(() => {
    region.textContent = message;
  }, 60);
}

// 只用在「組出要下載的 HTML 字串」；放進頁面的文字一律用 textContent
function escHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function onMediaChange(query, handler) {
  if (typeof query.addEventListener === 'function') query.addEventListener('change', handler);
  else if (typeof query.addListener === 'function') query.addListener(handler);
}

// ---------- 深淺色 ----------

function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  // 手機瀏覽器網址列顏色跟著背景色（顏色取自 CSS 變數，不在 JS 寫死）
  const meta = $('meta[name="theme-color"]');
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (meta && bg) meta.setAttribute('content', bg);
}

function initTheme() {
  applyTheme(getTheme());

  $('#theme-toggle')?.addEventListener('click', () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    storage.set(THEME_KEY, next);
    announce(next === 'dark' ? '已切換為深色模式' : '已切換為淺色模式');
  });

  // 還沒手動切換過的人：系統改深淺色時，網站即時跟著變
  onMediaChange(window.matchMedia('(prefers-color-scheme: dark)'), (event) => {
    const saved = storage.get(THEME_KEY);
    if (saved !== 'light' && saved !== 'dark') applyTheme(event.matches ? 'dark' : 'light');
  });
}

// ---------- 顯示範本 ----------

function renderTemplates() {
  Object.entries(TEMPLATES).forEach(([key, { text }]) => {
    const target = document.getElementById(`code-${key}`);
    // textContent：範本文字只會被當成文字，不會被當成 HTML 執行
    if (target) target.textContent = text;
  });

  const lineCount = $('#full-line-count');
  if (lineCount) lineCount.textContent = String(FULL_TEMPLATE.split('\n').length);
}

// ---------- 複製 ----------

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 權限被拒或不支援：改用下面的舊方法
    }
  }
  return legacyCopy(text);
}

// 舊方法：非 https、file:// 或剪貼簿 API 失敗時使用
function legacyCopy(text) {
  const previousFocus = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  textarea.style.fontSize = '16px'; // 避免 iOS 聚焦時自動放大畫面
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }

  textarea.remove();
  if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  return ok;
}

// 兩種方法都失敗：幫使用者把範例文字選起來，直接按 Ctrl+C（Mac：⌘+C）
function selectTemplateText(key) {
  const code = document.getElementById(`code-${key}`);
  if (!code) return;
  const details = code.closest('details');
  if (details) details.open = true;
  const range = document.createRange();
  range.selectNodeContents(code);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

const feedbackTimers = new WeakMap();
function showCopyFeedback(button, ok) {
  const label = $('.btn-label', button) || button;
  // 每顆按鈕各自記住原本的文字
  if (!button.dataset.original) button.dataset.original = label.textContent;
  label.textContent = ok ? '✓ 已複製' : '複製失敗，已幫你選取文字';
  button.classList.toggle('is-copied', ok);

  window.clearTimeout(feedbackTimers.get(button));
  feedbackTimers.set(
    button,
    window.setTimeout(() => {
      label.textContent = button.dataset.original;
      button.classList.remove('is-copied');
    }, 2000),
  );
}

function initCopy() {
  $$('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const key = button.dataset.copy;
      const template = TEMPLATES[key];
      if (!template) return;

      const ok = await copyText(template.text);
      showCopyFeedback(button, ok);
      if (ok) {
        announce(`已複製${template.name}到剪貼簿`);
      } else {
        selectTemplateText(key);
        announce(`複製失敗，已選取${template.name}，請按 Ctrl+C 複製`);
      }
    });
  });
}

// ---------- 下載 ----------

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 稍等再釋放，避免部分瀏覽器還沒開始下載就被取消
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  announce(`開始下載 ${filename}`);
}

function buildHtmlGuide() {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MD 文件排版入門 - 完整範本</title>
<style>
  :root { color-scheme: light dark; }
  body { max-width: 72ch; margin: 0 auto; padding: 24px; font-family: -apple-system, "Segoe UI", "Microsoft JhengHei", sans-serif; font-size: 18px; line-height: 1.8; }
  pre { padding: 16px; border: 1px solid rgba(127, 127, 127, 0.4); border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 15px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>
<h1>MD 文件排版入門 - 完整範本</h1>
<p>把下面的內容貼到你的 .md 檔，再換成自己的文字。</p>
<pre>${escHtml(FULL_TEMPLATE)}</pre>
</body>
</html>
`;
}

function initDownloads() {
  $$('[data-download]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.download === 'html') {
        downloadFile(HTML_FILENAME, buildHtmlGuide(), 'text/html;charset=utf-8');
      } else {
        downloadFile(MD_FILENAME, `${FULL_TEMPLATE}\n`, 'text/markdown;charset=utf-8');
      }
    });
  });
}

// ---------- 檢查清單 ----------

function initChecklist() {
  const inputs = $$('.check-input');
  const total = inputs.length;
  if (!total) return;

  const readSaved = () => {
    try {
      const parsed = JSON.parse(storage.get(CHECK_KEY) || '[]');
      // 只接受合法題號，資料被改壞也不會影響畫面
      return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n) && n >= 0 && n < total) : [];
    } catch {
      return [];
    }
  };

  const save = () => {
    const checked = inputs.flatMap((input, index) => (input.checked ? [index] : []));
    storage.set(CHECK_KEY, JSON.stringify(checked));
  };

  const update = () => {
    const count = inputs.filter((input) => input.checked).length;
    const text = `${count}/${total}`;

    $$('[data-progress-count]').forEach((el) => {
      el.textContent = text;
    });
    $$('[data-progress-bar]').forEach((bar) => {
      bar.style.width = `${(count / total) * 100}%`;
    });

    const meter = $('#checklist-progress');
    if (meter) {
      meter.setAttribute('aria-valuemax', String(total));
      meter.setAttribute('aria-valuenow', String(count));
      meter.setAttribute('aria-valuetext', `已完成 ${count} 項，共 ${total} 項`);
    }

    inputs.forEach((input) => {
      input.closest('.check-item')?.classList.toggle('is-checked', input.checked);
    });

    const celebrate = $('#celebrate');
    if (celebrate) celebrate.hidden = count !== total;
    return count;
  };

  const saved = new Set(readSaved());
  inputs.forEach((input, index) => {
    input.checked = saved.has(index);

    input.addEventListener('change', () => {
      save();
      const count = update();
      announce(count === total ? `全部 ${total} 項完成！` : `檢查清單 ${count}/${total}`);
    });

    // 原生 checkbox 只支援空白鍵；這裡補上 Enter，和原版操作一致
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.click();
      }
    });
  });

  $('#checklist-reset')?.addEventListener('click', () => {
    inputs.forEach((input) => {
      input.checked = false;
    });
    save();
    update();
    announce('已清除全部勾選');
  });

  update();
}

// ---------- 章節導覽 ----------

function initSectionNav() {
  const links = $$('.nav-link[data-nav]');
  const sections = links.map((link) => document.getElementById(link.dataset.nav)).filter(Boolean);

  // 手機版章節列可橫向滑動：把目前章節捲到看得到的位置
  const keepVisible = (link) => {
    const list = link.closest('.nav-list');
    if (!list || list.scrollWidth <= list.clientWidth) return;
    const left = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, left), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  };

  const setActive = (id) => {
    links.forEach((link) => {
      if (link.dataset.nav === id) {
        link.setAttribute('aria-current', 'true');
        keepVisible(link);
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  links.forEach((link) => {
    link.addEventListener('click', () => setActive(link.dataset.nav));
  });

  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { rootMargin: '-40% 0px -50% 0px', threshold: 0 },
  );
  sections.forEach((section) => observer.observe(section));
}

// ---------- 啟動 ----------

function init() {
  initTheme();
  renderTemplates();
  initCopy();
  initDownloads();
  initChecklist();
  initSectionNav();
  // 給 index.html 底部的檢查用：沒有這個標記就顯示「範例沒有載入」提示
  document.documentElement.setAttribute('data-app-ready', 'true');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
