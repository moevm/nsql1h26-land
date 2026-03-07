import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(username, password);
      } else {
        await login(username, password);
      }
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto animate-fade-in-up pt-8">
      <h1
        className="text-2xl sm:text-3xl font-bold mb-2 text-center"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
      >
        {isRegister ? 'Регистрация' : 'Вход'}
      </h1>
      <p className="mb-6 text-sm text-center" style={{ color: 'var(--c-text-muted)' }}>
        {isRegister
          ? 'Создайте аккаунт для управления объявлениями'
          : 'Войдите для редактирования и управления'}
      </p>

      {error && (
        <div
          className="px-4 py-3 rounded-xl mb-5 text-sm"
          style={{ background: 'var(--c-red-dim)', color: 'var(--c-red)', border: '1px solid var(--c-red)' }}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl p-6 space-y-4"
        style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
      >
        <div>
          <label
            htmlFor="login-username"
            className="block text-xs mb-1.5 uppercase tracking-wide"
            style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Имя пользователя
          </label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            className="input-field"
            autoComplete="username"
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-xs mb-1.5 uppercase tracking-wide"
            style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            Пароль
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
            className="input-field"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
          {loading
            ? 'Загрузка...'
            : isRegister
              ? 'Зарегистрироваться'
              : 'Войти'}
        </button>

        <p className="text-center text-sm" style={{ color: 'var(--c-text-muted)' }}>
          {isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}{' '}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="underline"
            style={{ color: 'var(--c-accent)' }}
          >
            {isRegister ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </p>
      </form>

      <p
        className="text-xs mt-4 text-center"
        style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}
      >
        Админ по умолчанию: admin / admin
      </p>
    </div>
  );
}
