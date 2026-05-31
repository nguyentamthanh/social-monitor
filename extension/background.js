chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'CHECK_URL') {
    const { url, apiKey, appUrl } = msg
    fetch(`${appUrl}/api/extension/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, url })
    })
      .then(async (res) => {
        const data = await res.json()
        sendResponse({ ok: res.ok, data })
      })
      .catch((err) => sendResponse({ ok: false, data: { message: err.message } }))
    return true // keep channel open for async response
  }

  if (msg.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage()
  }
})
