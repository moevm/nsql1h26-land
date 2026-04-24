import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../contexts/AuthContext';
import { authFormSchema, type AuthFormValues } from '../features/forms/schemas';
import { AlertMessage } from '../components/AlertMessage';
import { PageHeader } from '../components/PageHeader';
import { Button, FieldError, FieldLabel, Input, Surface } from '../components/ui';
import { getErrorMessage } from '../utils';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');

  const {
    register: registerField,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    resolver: zodResolver(authFormSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  async function onSubmit(values: AuthFormValues) {
    setError('');
    try {
      if (isRegister) {
        await register(values.username, values.password);
      } else {
        await login(values.username, values.password);
      }
      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  let submitLabel = 'Войти';
  if (isSubmitting) {
    submitLabel = 'Загрузка...';
  } else if (isRegister) {
    submitLabel = 'Зарегистрироваться';
  }

  return (
    <div className="max-w-md mx-auto animate-fade-in-up pt-8">
      <PageHeader
        title={isRegister ? 'Регистрация' : 'Вход'}
        subtitle={
          isRegister
            ? 'Создайте аккаунт для управления объявлениями'
            : 'Войдите для редактирования и управления'
        }
        titleClassName="text-center"
        subtitleClassName="text-center"
      />

      <AlertMessage message={error} />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <Surface className="p-6 space-y-4">
          <div>
            <FieldLabel htmlFor="login-username">Имя пользователя</FieldLabel>
            <Input
            id="login-username"
            type="text"
            {...registerField('username')}
            autoComplete="username"
            />
            <FieldError message={errors.username?.message} />
          </div>

          <div>
            <FieldLabel htmlFor="login-password">Пароль</FieldLabel>
            <Input
            id="login-password"
            type="password"
            {...registerField('password')}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            <FieldError message={errors.password?.message} />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full py-3">
            {submitLabel}
          </Button>

          <p className="text-center text-sm" style={{ color: 'var(--c-text-muted)' }}>
            {isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}{' '}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsRegister(!isRegister);
                reset();
                setError('');
              }}
              className="underline p-0 h-auto min-h-0"
              style={{ color: 'var(--c-accent)', background: 'transparent', border: 'none' }}
            >
              {isRegister ? 'Войти' : 'Зарегистрироваться'}
            </Button>
          </p>
        </Surface>
      </form>
    </div>
  );
}
