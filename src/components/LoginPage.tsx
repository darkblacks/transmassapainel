import { FormEvent, useState } from 'react'
import { motion } from 'framer-motion'
import { LockKeyhole, Truck } from 'lucide-react'
import { login, TOKEN_KEY } from '../services/api'
import type { Session } from '../types'

interface Props {
  onLogin: (session: Session) => void
}

export default function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState('sp@transmassa.local')
  const [password, setPassword] = useState('SP@12345')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await login(email, password)
      localStorage.setItem(TOKEN_KEY, data.token)
      onLogin({ user: data.user, preferences: data.preferences })
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Não foi possível entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-screen">
      <motion.form
        className="login-card"
        onSubmit={submit}
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        <div className="login-brand"><Truck/><span>TRANSMASSA</span></div>
        <div className="login-icon"><LockKeyhole/></div>
        <span className="login-eyebrow">TORRE DE CONTROLE</span>
        <h1>Acesso operacional</h1>
        <p>Seu login carrega o grupo de frota configurado para você.</p>

        <label>
          E-mail
          <input value={email} onChange={e => setEmail(e.target.value)} type="email"/>
        </label>

        <label>
          Senha
          <input value={password} onChange={e => setPassword(e.target.value)} type="password"/>
        </label>

        {error && <div className="login-error">{error}</div>}

        <button disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </motion.form>
    </main>
  )
}
