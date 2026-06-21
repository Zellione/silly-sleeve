import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import App from './App'
import {initFontScale} from './utils/fontScale'
import {initAccent} from './utils/accent'
import {initSidebarStyle} from './utils/sidebarStyle'
import {initStepBadges} from './utils/stepBadges'

initFontScale()
initAccent()
initSidebarStyle()
initStepBadges()

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
)
