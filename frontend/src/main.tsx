import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App apiBaseUrl={import.meta.env.VITE_API_URL || 'http://localhost:3000/api'} /></StrictMode>)
