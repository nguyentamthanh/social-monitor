const appUrlInput = document.getElementById('appUrl')
const apiKeyInput = document.getElementById('apiKey')
const saveBtn     = document.getElementById('saveBtn')
const testBtn     = document.getElementById('testBtn')
const clearBtn    = document.getElementById('clearBtn')
const statusDot   = document.getElementById('statusDot')
const statusText  = document.getElementById('statusText')
const toast       = document.getElementById('toast')
const settingsLink = document.getElementById('settingsLink')

function showToast(msg, type = 'success') {
  toast.textContent = msg
  toast.className = `toast show ${type}`
  clearTimeout(showToast._t)
  showToast._t = setTimeout(() => { toast.className = 'toast' }, 3000)
}

function setStatus(state, text) {
  statusDot.className = `dot ${state}`
  statusText.textContent = text
}

// Load saved settings on open
chrome.storage.sync.get(['apiKey', 'appUrl'], (data) => {
  if (data.appUrl) appUrlInput.value = data.appUrl
  if (data.apiKey) apiKeyInput.value = data.apiKey
  updateSettingsLink()
})

function updateSettingsLink() {
  const base = appUrlInput.value.trim().replace(/\/$/, '')
  if (base) settingsLink.href = `${base}/settings`
}

appUrlInput.addEventListener('input', updateSettingsLink)

saveBtn.addEventListener('click', () => {
  const appUrl = appUrlInput.value.trim().replace(/\/$/, '')
  const apiKey = apiKeyInput.value.trim()

  if (!appUrl) { showToast('Vui lòng nhập URL ứng dụng', 'error'); return }
  if (!apiKey) { showToast('Vui lòng nhập API key', 'error'); return }

  chrome.storage.sync.set({ appUrl, apiKey }, () => {
    showToast('✓ Đã lưu cài đặt')
    updateSettingsLink()
  })
})

testBtn.addEventListener('click', async () => {
  const appUrl = appUrlInput.value.trim().replace(/\/$/, '')
  const apiKey = apiKeyInput.value.trim()

  if (!appUrl || !apiKey) {
    showToast('Nhập URL và API key trước', 'error')
    return
  }

  setStatus('yellow', 'Đang kiểm tra…')
  testBtn.disabled = true

  try {
    // Test by checking a known YouTube URL (the official YouTube channel)
    const res = await fetch(`${appUrl}/api/extension/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    })
    const data = await res.json()

    if (res.status === 401) {
      setStatus('yellow', `⚠️ ${data.message || 'API key không hợp lệ'}`)
      showToast(data.message || 'API key không hợp lệ', 'error')
    } else if (res.ok || res.status === 400) {
      // 400 = invalid_url is fine — means auth passed
      setStatus('green', '✓ Kết nối thành công')
      showToast('✓ Kết nối thành công!')
    } else {
      setStatus('yellow', `Lỗi ${res.status}`)
      showToast(`Lỗi ${res.status}: ${data.message || 'unknown'}`, 'error')
    }
  } catch (e) {
    setStatus('gray', `Không thể kết nối: ${e.message}`)
    showToast(`Không thể kết nối: ${e.message}`, 'error')
  } finally {
    testBtn.disabled = false
  }
})

clearBtn.addEventListener('click', () => {
  chrome.storage.sync.remove(['apiKey', 'appUrl'], () => {
    appUrlInput.value = ''
    apiKeyInput.value = ''
    setStatus('gray', 'Chưa kiểm tra kết nối')
    showToast('Đã xóa cài đặt')
  })
})
