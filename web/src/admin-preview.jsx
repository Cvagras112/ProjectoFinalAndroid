
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'

createRoot(document.getElementById('admin-root')).render(
  <StrictMode>
    <AdminDashboard />
  </StrictMode>
)
