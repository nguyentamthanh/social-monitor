let panelEl = null
let currentVideoId = null
let pendingCheck = false

function getVideoId() {
  const params = new URLSearchParams(location.search)
  const fromWatch = params.get('v')
  if (fromWatch) return fromWatch
  const shortsMatch = location.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/)
  return shortsMatch ? shortsMatch[1] : null
}

function waitForElement(selector, timeout = 6000) {
  return new Promise((resolve) => {
    const el = document.querySelector(selector)
    if (el) return resolve(el)
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector)
      if (found) { observer.disconnect(); resolve(found) }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => { observer.disconnect(); resolve(null) }, timeout)
  })
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiKey', 'appUrl'], (data) => {
      resolve({
        apiKey: data.apiKey || '',
        appUrl: (data.appUrl || '').replace(/\/$/, '')
      })
    })
  })
}

function riskColor(score) {
  if (score >= 70) return '#ef4444'
  if (score >= 40) return '#f59e0b'
  return '#10b981'
}

function renderLoading() {
  return `
    <div class="sm-panel-inner">
      <div class="sm-header">🛡️ Social Monitor</div>
      <div class="sm-loading">Đang kiểm tra bản quyền…</div>
    </div>`
}

function renderSetupNeeded() {
  return `
    <div class="sm-panel-inner">
      <div class="sm-header">🛡️ Social Monitor</div>
      <div class="sm-warning">⚙️ Chưa cấu hình —
        <a id="sm-open-options">Mở cài đặt</a>
      </div>
    </div>`
}

function renderError(msg) {
  return `
    <div class="sm-panel-inner">
      <div class="sm-header">🛡️ Social Monitor</div>
      <div class="sm-error">⚠️ ${msg}</div>
    </div>`
}

function renderResult(data, appUrl) {
  const { matches = [], topScore = 0, assetsChecked = 0, noAssets } = data

  if (noAssets) {
    return `
      <div class="sm-panel-inner">
        <div class="sm-header">🛡️ Social Monitor</div>
        <div class="sm-info">Chưa có Brand Asset nào.
          <a href="${appUrl}/assets" target="_blank">Thêm tài sản →</a>
        </div>
      </div>`
  }

  const color = riskColor(topScore)
  const matchRows = matches.length === 0
    ? `<div class="sm-clean">✅ Không phát hiện vi phạm</div>`
    : matches.slice(0, 4).map(m => `
        <div class="sm-match">
          <div class="sm-match-name">${escHtml(m.assetName)}</div>
          <div class="sm-match-score" style="color:${riskColor(m.riskScore)}">${m.riskScore}</div>
        </div>`).join('')

  return `
    <div class="sm-panel-inner">
      <div class="sm-header">
        🛡️ Social Monitor
        <span class="sm-score" style="background:${color}20;color:${color};border-color:${color}40">${topScore}</span>
      </div>
      <div class="sm-meta">${assetsChecked} tài sản được kiểm tra</div>
      ${matchRows}
      ${matches.length > 0
        ? `<a href="${appUrl}/findings" target="_blank" class="sm-link">Xem chi tiết Findings →</a>`
        : ''}
    </div>`
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

async function injectPanel(videoId) {
  if (pendingCheck) return
  pendingCheck = true

  try {
    const sidebar = await waitForElement('#secondary-inner, #secondary')
    if (!sidebar) return

    // Remove existing panel
    document.getElementById('sm-panel')?.remove()

    panelEl = document.createElement('div')
    panelEl.id = 'sm-panel'
    panelEl.innerHTML = renderLoading()
    sidebar.prepend(panelEl)

    const settings = await getSettings()

    if (!settings.apiKey || !settings.appUrl) {
      panelEl.innerHTML = renderSetupNeeded()
      panelEl.querySelector('#sm-open-options')?.addEventListener('click', (e) => {
        e.preventDefault()
        chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' })
      })
      return
    }

    chrome.runtime.sendMessage(
      { type: 'CHECK_URL', url: location.href, apiKey: settings.apiKey, appUrl: settings.appUrl },
      (response) => {
        if (!panelEl) return
        if (!response || !response.ok) {
          panelEl.innerHTML = renderError(response?.data?.message || 'Lỗi kết nối tới app')
        } else {
          panelEl.innerHTML = renderResult(response.data, settings.appUrl)
        }
      }
    )
  } finally {
    pendingCheck = false
  }
}

function onNavigate() {
  const vid = getVideoId()
  if (vid && vid !== currentVideoId) {
    currentVideoId = vid
    injectPanel(vid)
  }
}

// YouTube SPA navigation event
document.addEventListener('yt-navigate-finish', onNavigate)

// Initial load
const initVid = getVideoId()
if (initVid) {
  currentVideoId = initVid
  injectPanel(initVid)
}
