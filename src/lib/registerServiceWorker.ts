export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return

  const onLoad = () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('[pwa] service worker registration failed', error)
    })
  }

  if (document.readyState === 'complete') {
    onLoad()
  } else {
    window.addEventListener('load', onLoad, { once: true })
  }
}
