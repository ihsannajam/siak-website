import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, toast } from '@heroui/react'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../lib/api'
import { TextInput } from '../components/ui'
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
      toast.danger(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f58b0b] to-[#fbab1d] p-4">
      <Card className="w-full max-w-sm p-6 shadow-xl">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col items-center gap-2">
            <img src={logoLogin} alt="Logo An Nahl ANDA" className="h-28 object-contain" />
            <p className="text-center text-sm text-muted">Sistem Informasi Akademik RQ An Nahl</p>
          </div>

          <TextInput label="Username" value={username} onChange={setUsername} placeholder="admin" autoFocus />
          <TextInput label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />

          <Button fullWidth type="submit" isPending={loading}>
            {loading ? 'Memproses…' : 'Masuk'}
          </Button>

          <div className="rounded-lg bg-default p-3 text-xs text-muted">
            <strong>Akun demo</strong> (password: <code>Annahl123!</code>)
            <br />
            admin · guru · kepsek · yayasan
          </div>
        </form>
      </Card>
    </div>
  )
}
