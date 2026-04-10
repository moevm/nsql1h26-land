import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Database,
  GitCompare,
  LayoutGrid,
  List,
  LogIn,
  LogOut,
  Map,
  Monitor,
  Moon,
  PlusSquare,
  Shield,
  Sun,
  User,
} from 'lucide-react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';

import ErrorBoundary from './components/ErrorBoundary';
import { PageTransition } from './components/common/PageTransition';
import { RouteSkeleton } from './components/common/RouteSkeleton';
import { useAuth } from './contexts/AuthContext';
import { useThemeSync } from './hooks/useThemeSync';
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
  const { user, logout, isAdmin } = useAuth();
  const { resolvedTheme, toggleTheme, setThemePreference, isSystemTheme } = useThemeSync();
  const compareCount = useUserPrefsStore((state) => state.comparePlotIds.length);
  const compareLabel = compareCount ? `Сравнение (${compareCount})` : 'Сравнение';

  const withRouteBoundary = (page: ReactNode) => (
    <ErrorBoundary fullScreen={false} title="Ошибка раздела">
      <PageTransition>{page}</PageTransition>
    </ErrorBoundary>
  );

  const navLinks: NavItem[] = [
    { to: '/', label: 'Каталог', Icon: LayoutGrid, show: true, end: true },
    { to: '/map', label: 'Карта', Icon: Map, show: true },
    {
      to: '/compare',
      label: compareLabel,
      Icon: GitCompare,
      show: true,
    },
    { to: '/add', label: 'Новый участок', Icon: PlusSquare, show: Boolean(user) },
    { to: '/my', label: 'Мои объявления', Icon: List, show: Boolean(user) },
    { to: '/admin', label: 'Панель данных', Icon: Database, show: isAdmin },
  ];

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link">
        Перейти к содержимому
      </a>

      <header className="app-header sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="flex items-center justify-between gap-3 h-16">
            <Link to="/" className="flex items-center gap-3 no-underline shrink-0">
              <span className="app-brand-mark">ЗУ</span>
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

            <div className="flex items-center min-w-0 flex-1 justify-end">
              <nav className="flex items-center gap-1 overflow-x-auto max-w-full py-1" aria-label="Основная навигация">
                {navLinks
                  .filter((item) => item.show)
                  .map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => cn('app-nav-link whitespace-nowrap', isActive && 'active')}
                    >
                      <item.Icon size={15} className="opacity-75" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}

                <div className="flex items-center gap-1 ml-1">
                  <button
                    type="button"
                    className="btn-ghost px-2! py-1.5!"
                    onClick={toggleTheme}
                    title={resolvedTheme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему'}
                    aria-label={resolvedTheme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему'}
                  >
                    {resolvedTheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2! py-1.5!"
                    onClick={() => setThemePreference('system')}
                    title="Системная тема"
                    aria-label="Системная тема"
                    aria-pressed={isSystemTheme}
                    style={{
                      color: isSystemTheme ? 'var(--c-accent)' : 'var(--c-text-muted)',
                      borderColor: isSystemTheme ? 'var(--c-accent)' : 'var(--c-border)',
                    }}
                  >
                    <Monitor size={15} />
                  </button>
                </div>

                {user ? (
                  <div className="flex items-center gap-2 ml-2 pl-2 sm:ml-3 sm:pl-3 border-l" style={{ borderColor: 'var(--c-border)' }}>
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
                ) : (
                  <NavLink to="/login" className="app-nav-link ml-2 pl-2 sm:ml-3 sm:pl-3 border-l" style={{ borderColor: 'var(--c-border)' }}>
                    <LogIn size={15} />
                    <span>Войти</span>
                  </NavLink>
                )}
              </nav>
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
              <Route path="/login" element={withRouteBoundary(<LoginPage />)} />
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
        LAND PLOTS SERVICE 2026
      </footer>
    </div>
  );
}
