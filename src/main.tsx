import {Capacitor} from '@capacitor/core'
import {createRoot} from 'react-dom/client'
import './index.css'
import App from './App'

// Native-only styling keeps the web experience unchanged.
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native-app')
  document.body.classList.add('native-app')
  document.documentElement.style.setProperty('--native-platform', Capacitor.getPlatform())
}

createRoot(document.getElementById('root')!).render(<App />)
