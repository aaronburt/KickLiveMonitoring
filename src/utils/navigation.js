export function openOptionsPage(e) {
  e?.preventDefault?.();
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    const url = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('src/options/options.html')
      : 'chrome-extension://khginnookedbgdjokkogccfkckdpgalh/src/options/options.html';
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  }
}

export function openPrivacyPage(e) {
  e?.preventDefault?.();
  const url = typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('src/privacy/privacy.html')
    : '../privacy/privacy.html';
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
}
