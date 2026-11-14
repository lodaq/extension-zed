import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './main.css'

function sizePopup({ width, height }: chrome.windows.Window) {
  const style = document.documentElement.style
  // Leave room for the toolbar to the right of the popup's anchor.
  style.setProperty('--zed-popup-width', `${Math.max(200, Math.min(640, Math.min(width ?? screen.availWidth, screen.availWidth) - 128))}px`)
  style.setProperty('--zed-popup-h', `${Math.max(1, Math.min(600, Math.min(height ?? screen.availHeight, screen.availHeight) - 128))}px`)
}

async function startPopup() {
  if (!chrome.windows) return
  const host = await chrome.windows.getCurrent()
  sizePopup(host)
  chrome.windows.onBoundsChanged.addListener(window => {
    if (window.id === host.id) sizePopup(window)
  })
}

void startPopup().catch(() => { /* Retain the 200px fallback if window bounds are unavailable. */ }).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
})
