import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../lib/api'
import logoLogin from '../assets/logo-vertical.png'

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) {
    navigate('/dashboard', { replace: true })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(username, password)
      toast.success('Login berhasil')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo-container">
          <img src={logoLogin} alt="Logo An Nahl ANDA" className="login-logo" />
        </div>
        <p className="sub">Sistem Informasi Akademik RQ An Nahl</p>

        <div className="form-group">
          <label>Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
          {loading ? 'Memproses…' : 'Masuk'}
        </button>

        <div className="login-demo">
          <strong>Akun demo</strong> (password: <code>Annahl123!</code>)
          <br />
          admin · guru · kepsek · yayasan
        </div>
      </form>
    </div>
  )
}
