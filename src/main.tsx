import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toast } from '@heroui/react'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
})

// Setelah deploy baru, file halaman versi lama hilang. Muat ulang sekali agar tidak jadi halaman putih.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'siak-chunk-reload-at'
  const lastReload = Number(sessionStorage.getItem(key) ?? 0)
  if (Date.now() - lastReload < 30_000) return
  event.preventDefault()
  sessionStorage.setItem(key, String(Date.now()))
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toast.Provider placement="top end" />
    </QueryClientProvider>
  </StrictMode>,
)
