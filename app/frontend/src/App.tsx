import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Database,
  GitCompare,
  LayoutGrid,
  List,
  LogOut,
  Map,
  PlusSquare,
  Shield,
  User,
} from 'lucide-react';
import { IconMap2 } from '@tabler/icons-react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';

import ErrorBoundary from './components/ErrorBoundary';
import { PageTransition } from './components/common/PageTransition';
import { RouteSkeleton } from './components/common/RouteSkeleton';
import { useAuth } from './contexts/AuthContext';
import { cn } from './lib/cn';
import { useUserPrefsStore } from './stores/userPrefsStore';

const PlotsList = lazy(() => import('./pages/PlotsList'));
const PlotDetail = lazy(() => import('./pages/PlotDetail'));
const AddPlot = lazy(() => import('./pages/AddPlot'));
const EditPlot = lazy(() => import('./pages/EditPlot'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const PlotsMap = lazy(() => import('./pages/PlotsMap'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const MyPlots = lazy(() => import('./pages/MyPlots'));
const ComparePlots = lazy(() => import('./pages/ComparePlots'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

type NavItem = {
  to: string;
  label: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  show: boolean;
  end?: boolean;
};

export default function App() {
  const location = useLocation();
  const { user, loading, logout, isAdmin } = useAuth();
  const compareCount = useUserPrefsStore((state) => state.comparePlotIds.length);
  const compareLabel = compareCount ? `Сравнение (${compareCount})` : 'Сравнение';

  const withRouteBoundary = (page: ReactNode) => (
    <ErrorBoundary fullScreen={false} title="Ошибка раздела">
      <PageTransition>{page}</PageTransition>
    </ErrorBoundary>
  );

  // Пока идёт проверка токена — показываем скелетон, а не форму входа
  // (иначе пользователь с валидным токеном увидит флеш логина).
  if (loading) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center">
        <RouteSkeleton />
      </div>
    );
  }

  // Гейт: без авторизации доступна только страница входа.
  if (!user) {
    return (
      <div className="app-shell min-h-screen flex flex-col">
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 w-full">
          <Suspense fallback={<RouteSkeleton />}>
            <LoginPage />
          </Suspense>
        </main>
        <footer
          className="mt-auto py-6 text-center text-[11px] tracking-[0.2em]"
          style={{
            color: 'var(--c-text-dim)',
            borderTop: '1px solid var(--c-border)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          LAND PLOTS SERVICE
        </footer>
      </div>
    );
  }

  const navLinks: NavItem[] = [
    { to: '/', label: 'Каталог', Icon: LayoutGrid, show: true, end: true },
    { to: '/map', label: 'Карта', Icon: Map, show: true },
    { to: '/compare', label: compareLabel, Icon: GitCompare, show: true },
    { to: '/add', label: 'Новый участок', Icon: PlusSquare, show: true },
    { to: '/my', label: 'Мои объявления', Icon: List, show: true },
    { to: '/admin', label: 'Панель данных', Icon: Database, show: isAdmin },
  ];

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">
        Перейти к содержимому
      </a>

      <header className="app-header sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="flex items-center justify-between gap-2 min-h-16 py-2 flex-wrap">
            <Link to="/" className="flex items-center gap-3 no-underline shrink-0">
              <span className="app-brand-mark" aria-label="Земельные участки">
                <IconMap2 size={22} stroke={1.75} />
              </span>
              <span
                className="text-base sm:text-lg tracking-tight hidden sm:inline"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  color: 'var(--c-heading)',
                }}
              >
                Земельные участки
              </span>
            </Link>

            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end flex-wrap">
              <nav className="flex items-center gap-1 flex-wrap justify-end" aria-label="Основная навигация">
                {navLinks
                  .filter((item) => item.show)
                  .map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => cn('app-nav-link', isActive && 'active')}
                    >
                      <item.Icon size={15} className="opacity-75" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
              </nav>

              <div className="flex items-center gap-2">
                <span
                  className="app-user-chip inline-flex items-center gap-1.5"
                  style={{
                    background: isAdmin ? 'var(--c-accent-dim)' : 'var(--c-blue-dim)',
                    color: isAdmin ? 'var(--c-accent)' : 'var(--c-blue)',
                  }}
                >
                  {isAdmin ? <Shield size={12} /> : <User size={12} />}
                  {user.username}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="btn-ghost px-2! py-1.5!"
                  style={{
                    color: 'var(--c-text-muted)',
                    borderColor: 'var(--c-border)',
                  }}
                  title="Выйти"
                  aria-label="Выйти из аккаунта"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-7 sm:py-8 w-full">
        <Suspense fallback={<RouteSkeleton />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={withRouteBoundary(<PlotsList />)} />
              <Route path="/map" element={withRouteBoundary(<PlotsMap />)} />
              <Route path="/compare" element={withRouteBoundary(<ComparePlots />)} />
              <Route path="/plots/:id" element={withRouteBoundary(<PlotDetail />)} />
              <Route path="/plots/:id/edit" element={withRouteBoundary(<EditPlot />)} />
              <Route path="/add" element={withRouteBoundary(<AddPlot />)} />
              <Route path="/my" element={withRouteBoundary(<MyPlots />)} />
              <Route path="/admin" element={withRouteBoundary(<AdminPanel />)} />
              <Route path="*" element={withRouteBoundary(<NotFoundPage />)} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>

      <footer
        className="mt-auto py-6 text-center text-[11px] tracking-[0.2em]"
        style={{
          color: 'var(--c-text-dim)',
          borderTop: '1px solid var(--c-border)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        LAND PLOTS SERVICE
      </footer>
    </div>
  );
}
