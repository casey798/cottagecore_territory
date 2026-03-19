import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/locations', label: 'Locations' },
  { to: '/roster', label: 'Roster Import' },
  { to: '/map-calibration', label: 'Map Calibration' },
  { to: '/daily-config', label: 'Daily Config' },
  { to: '/qr-generator', label: 'QR Generator' },
  { to: '/capture-history', label: 'History' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/users', label: 'Users' },
  { to: '/season', label: 'Season' },
  { to: '/cluster-config', label: 'Clusters' },
  { to: '/phase1-import', label: 'Phase 1 Import' },
];

export function Layout({ children }: { children: ReactNode }) {
  const email = useAuthStore((s) => s.email);
  const storeLogout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);

  function logout() {
    storeLogout();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen">
      <aside
        className={`flex flex-col bg-[#8B6914] text-white transition-all ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/20 p-3">
          {!collapsed && (
            <span className="text-lg font-bold">GroveWars</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded p-1 hover:bg-white/10"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '>' : '<'}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#D4A843] font-semibold text-[#3D2B1F]'
                    : 'hover:bg-white/10'
                } ${collapsed ? 'text-center' : ''}`
              }
              title={item.label}
            >
              {collapsed ? item.label[0] : item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/20 p-3">
          {!collapsed && (
            <p className="mb-2 truncate text-xs opacity-80">{email}</p>
          )}
          <button
            onClick={logout}
            className="w-full rounded bg-white/20 px-2 py-1 text-sm hover:bg-white/30"
          >
            {collapsed ? 'X' : 'Logout'}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-[#F5EACB] p-6">
        {children}
      </main>
    </div>
  );
}
