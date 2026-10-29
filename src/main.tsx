import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { initializeDatabase } from './db/db'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('The root element is missing.')
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

registerSW({ immediate: true })

void initializeDatabase().catch((error: unknown) => {
  console.error('Nie udało się otworzyć lokalnej bazy danych.', error)
})
