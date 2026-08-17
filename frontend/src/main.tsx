import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import App from './App'
import {initFontScale} from './utils/fontScale'
import {initAccent} from './utils/accent'
import {initTheme} from './utils/theme'

initFontScale()
initAccent()
initTheme()

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
)
