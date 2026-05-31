const urlInput = document.getElementById('urlInput')
const checkBtn = document.getElementById('checkBtn')
const resultDiv = document.getElementById('result')
const settingsBtn = document.getElementById('settingsBtn')

function riskColor(score) {
  if (score >= 70) return '#ef4444'
  if (score >= 40) return '#f59e0b'
  return '#10b981'
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiKey', 'appUrl'], (d) => {
      resolve({ apiKey: d.apiKey || '', appUrl: (d.appUrl || '').replace(/\/$/, '') })
    })
  })
}

async function runCheck() {
  const url = urlInput.value.trim()
  if (!url) return

  const settings = await getSettings()

  if (!settings.apiKey || !settings.appUrl) {
    resultDiv.innerHTML = `
      <div class="no-config">⚙️ Chưa cấu hình API key.
        <a id="goSettings">Mở cài đặt →</a>
      </div>`
    document.getElementById('goSettings')?.addEventListener('click', () => chrome.runtime.openOptionsPage())
    return
  }

  checkBtn.disabled = true
  resultDiv.innerHTML = `<div class="result-loading"><div class="spinner"></div> Đang kiểm tra…</div>`

  chrome.runtime.sendMessage(
    { type: 'CHECK_URL', url, apiKey: settings.apiKey, appUrl: settings.appUrl },
    (response) => {
      checkBtn.disabled = false
      if (!response || !response.ok) {
        const msg = response?.data?.message || 'Lỗi kết nối'
        resultDiv.innerHTML = `<div class="error">⚠️ ${escHtml(msg)}</div>`
        return
      }

      const { video, matches = [], topScore = 0, assetsChecked = 0, noAssets, error } = response.data

      if (error) {
        resultDiv.innerHTML = `<div class="error">⚠️ ${escHtml(response.data.message || error)}</div>`
        return
      }

      if (noAssets) {
        resultDiv.innerHTML = `<div class="error" style="color:#a1a1aa">Chưa có Brand Asset nào trong tài khoản.</div>`
        return
      }

      const color = riskColor(topScore)
      const matchRows = matches.length === 0
        ? `<div class="clean">✅ Không phát hiện vi phạm</div>`
        : matches.slice(0, 4).map(m => `
            <div class="match-row">
              <div class="match-name">${escHtml(m.assetName)}</div>
              <div class="match-score" style="color:${riskColor(m.riskScore)}">${m.riskScore}</div>
            </div>`).join('')

      resultDiv.innerHTML = `
        ${video ? `<div class="result-title">${escHtml(video.title)}</div>` : ''}
        <span class="score-badge" style="background:${color}20;color:${color};border-color:${color}40">
          Risk: ${topScore}
        </span>
        <div class="meta">${assetsChecked} tài sản kiểm tra</div>
        ${matchRows}
        ${matches.length > 0
          ? `<a href="${settings.appUrl}/findings" target="_blank" class="open-link">Xem Findings →</a>`
          : ''}`
    }
  )
}

checkBtn.addEventListener('click', runCheck)
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runCheck() })
settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage())

// Pre-fill with current tab URL if it's YouTube
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || ''
  if (/youtube\.com\/(watch|shorts)|youtu\.be\//.test(url)) {
    urlInput.value = url
  }
})
