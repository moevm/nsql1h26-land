import { lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Map, PlusSquare, Database, LogIn, User, LogOut, Shield, List } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';

const PlotsList = lazy(() => import('./pages/PlotsList'));
const PlotDetail = lazy(() => import('./pages/PlotDetail'));
const AddPlot = lazy(() => import('./pages/AddPlot'));
const EditPlot = lazy(() => import('./pages/EditPlot'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const PlotsMap = lazy(() => import('./pages/PlotsMap'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const MyPlots = lazy(() => import('./pages/MyPlots'));

export default function App() {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();

  const navLinks = [
    { to: '/', label: 'Каталог', Icon: LayoutGrid, show: true },
    { to: '/map', label: 'Карта', Icon: Map, show: true },
    { to: '/add', label: 'Новый участок', Icon: PlusSquare, show: !!user },
    { to: '/my', label: 'Мои объявления', Icon: List, show: !!user },
    { to: '/admin', label: 'Панель данных', Icon: Database, show: isAdmin },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--c-bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          background: 'rgba(11,15,20,0.82)',
          borderBottom: '1px solid var(--c-border)',
        }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/"
              className="flex items-center gap-3 group"
              style={{ textDecoration: 'none' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, var(--c-accent), #c0915e)',
                  color: 'var(--c-bg)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                ЗУ
              </div>
              <span
                className="text-lg tracking-wide hidden sm:block"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  color: 'var(--c-heading)',
                }}
              >
                Земельные участки
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              {navLinks.filter(l => l.show).map((l) => {
                const active =
                  l.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(l.to);
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                    style={{
                      color: active ? 'var(--c-accent)' : 'var(--c-text-muted)',
                      background: active ? 'var(--c-accent-dim)' : 'transparent',
                      fontFamily: 'var(--font-body)',
                      fontWeight: active ? 600 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = 'var(--c-text)';
                        e.currentTarget.style.background = 'var(--c-surface-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = 'var(--c-text-muted)';
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <l.Icon size={15} className="inline-block mr-1.5 opacity-60" />
                    {l.label}
                    {active && (
                      <span
                        className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                        style={{ background: 'var(--c-accent)' }}
                      />
                    )}
                  </Link>
                );
              })}

              {/* User menu */}
              {user ? (
                <div className="flex items-center gap-2 ml-3 pl-3" style={{ borderLeft: '1px solid var(--c-border)' }}>
                  <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
                    style={{
                      background: isAdmin ? 'var(--c-accent-dim)' : 'var(--c-blue-dim)',
                      color: isAdmin ? 'var(--c-accent)' : 'var(--c-blue)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                    {isAdmin ? <Shield size={12} /> : <User size={12} />}
                    {user.username}
                  </span>
                  <button
                    onClick={logout}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--c-text-dim)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--c-red)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--c-text-dim)'}
                    title="Выйти"
                  >
                    <LogOut size={15} />
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 ml-3 pl-3 text-sm transition-colors"
                  style={{
                    borderLeft: '1px solid var(--c-border)',
                    color: 'var(--c-text-muted)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--c-accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--c-text-muted)'}
                >
                  <LogIn size={15} /> Войти
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-8 w-full">
        <Suspense fallback={<div className="text-center py-20" style={{ color: 'var(--c-text-muted)' }}>Загрузка…</div>}>
        <Routes>
          <Route path="/" element={<PlotsList />} />
          <Route path="/map" element={<PlotsMap />} />
          <Route path="/plots/:id" element={<PlotDetail />} />
          <Route path="/plots/:id/edit" element={<EditPlot />} />
          <Route path="/add" element={<AddPlot />} />
          <Route path="/my" element={<MyPlots />} />
          <Route path="/search" element={<PlotsList />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
        </Suspense>
      </main>

      <footer
        className="mt-auto py-6 text-center text-xs tracking-wider"
        style={{
          color: 'var(--c-text-dim)',
          borderTop: '1px solid var(--c-border)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        LAND · PLOTS · SERVICE — 2026
      </footer>
    </div>
  );
}
