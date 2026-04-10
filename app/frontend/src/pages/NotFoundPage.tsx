import { Link } from 'react-router-dom';

import { Surface } from '../components/ui';

export default function NotFoundPage() {
  return (
    <div className="max-w-xl mx-auto py-14 animate-fade-in-up">
      <Surface className="p-8 text-center">
        <p
          className="text-xs tracking-[0.2em] mb-3"
          style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}
        >
          404
        </p>
        <h1
          className="text-2xl sm:text-3xl font-bold mb-3"
          style={{ color: 'var(--c-heading)', fontFamily: 'var(--font-display)' }}
        >
          Страница не найдена
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--c-text-muted)' }}>
          Возможно, ссылка устарела или страница была перемещена.
        </p>

        <Link to="/" className="btn-primary inline-flex no-underline">
          Вернуться в каталог
        </Link>
      </Surface>
    </div>
  );
}
