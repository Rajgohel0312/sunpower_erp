import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Sun,
  LayoutDashboard,
  Users,
  UserCheck,
  LogOut,
  Shield,
  Layers,
  FileText,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  Package,
  ShoppingBag,
  Boxes,
  ShoppingCart,
  ShieldCheck,
  Truck,
  Wrench,
  LifeBuoy,
  CreditCard,
  TrendingUp,
  Receipt,
  KeyRound,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Badge from '../common/Badge.jsx';
import ChangePasswordModal from '../common/ChangePasswordModal.jsx';

export function AppLayout() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isCustomer = user?.roles?.includes('CUSTOMER');

  const customerNavItems = [
    {
      to: '/portal',
      label: 'My Solar Plant Portal',
      icon: Sun,
      exact: true
    }
  ];

  const staffNavItems = [
    {
      to: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      exact: true
    },
    {
      to: '/leads',
      label: 'CRM & Leads',
      icon: Layers,
      permission: 'leads:read'
    },
    {
      to: '/customers',
      label: 'Customers',
      icon: Users,
      permission: 'customers:read'
    },
    {
      to: '/surveys',
      label: 'Site Surveys',
      icon: ClipboardCheck,
      permission: 'surveys:read'
    },
    {
      to: '/catalog',
      label: 'Product Catalog',
      icon: Package,
      permission: 'catalog:read'
    },
    {
      to: '/quotations',
      label: 'Quotations & Pricing',
      icon: FileText,
      permission: 'quotations:read'
    },
    {
      to: '/orders',
      label: 'Sales Orders',
      icon: ShoppingBag,
      permission: 'orders:read'
    },
    {
      to: '/inventory/stock',
      label: 'Inventory & Stock',
      icon: Boxes,
      permission: 'inventory:read'
    },
    {
      to: '/procurement/orders',
      label: 'Procurement & POs',
      icon: ShoppingCart,
      permission: 'purchase_orders:read'
    },
    {
      to: '/inventory/serials',
      label: 'Serial Explorer',
      icon: ShieldCheck,
      permission: 'serials:read'
    },
    {
      to: '/dispatches',
      label: 'Material Dispatch',
      icon: Truck,
      permission: 'dispatches:read'
    },
    {
      to: '/installations',
      label: 'Installation Jobs',
      icon: Wrench,
      permission: 'installations:read'
    },
    {
      to: '/warranties',
      label: 'Warranties & AMC',
      icon: ShieldCheck,
      permission: 'warranties:read'
    },
    {
      to: '/tickets',
      label: 'Service Tickets',
      icon: LifeBuoy,
      permission: 'tickets:read'
    },
    {
      to: '/finance/invoices',
      label: 'Invoices & Billing',
      icon: Receipt,
      permission: 'invoices:read'
    },
    {
      to: '/finance/payments',
      label: 'Payments Ledger',
      icon: CreditCard,
      permission: 'payments:read'
    },
    {
      to: '/finance/profitability',
      label: 'Project P&L Margin',
      icon: TrendingUp,
      permission: 'finance:report'
    },
    {
      to: '/portal',
      label: 'Customer Portal',
      icon: Sun
    },
    {
      to: '/whatsapp',
      label: 'WhatsApp Bot',
      icon: MessageSquare,
      permission: 'leads:read'
    },
    {
      to: '/users',
      label: 'Users & Roles',
      icon: Shield,
      permission: 'users:read'
    }
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* 1. Midnight Navy Sidebar */}
      <aside className="w-64 bg-midnight flex flex-col flex-shrink-0 border-r border-midnight-dark select-none">
        {/* Brand Logo & Title */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-midnight-dark/80 bg-midnight-dark/30">
          <div className="w-9 h-9 rounded-lg bg-solar-gold flex items-center justify-center text-midnight shadow">
            <Sun className="w-5 h-5 fill-midnight" />
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight">SunPower ERP</span>
            <span className="block text-[10px] uppercase font-mono text-solar-gold tracking-widest font-semibold">Solar Lifecycle</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {(isCustomer ? customerNavItems : staffNavItems).map((item) => {
            if (item.permission && !hasPermission(item.permission)) {
              return null;
            }
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-midnight-light text-white font-semibold relative after:absolute after:right-0 after:top-1.5 after:bottom-1.5 after:w-1 after:bg-solar-gold after:rounded-l'
                      : 'text-slate-300 hover:text-white hover:bg-midnight-light/50'
                  }`
                }
              >
                <Icon className="w-4 h-4 text-slate-400 group-hover:text-white" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Card & Logout in Sidebar Footer */}
        <div className="p-3 border-t border-midnight-dark/80 bg-midnight-dark/20">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-midnight-dark/40">
            <div className="w-8 h-8 rounded-full bg-solar-gold text-midnight font-bold font-mono text-xs flex items-center justify-center flex-shrink-0">
              {user?.fullName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.fullName || user?.email}</p>
              <p className="text-[10px] text-slate-400 font-mono truncate">{user?.roles?.[0] || 'User'}</p>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setShowChangePassword(true)}
                title="Change Password"
                className="p-1.5 text-slate-400 hover:text-solar-gold hover:bg-midnight-dark rounded-md transition-colors"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-midnight-dark rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-midnight">
              {isCustomer ? 'SunPower Customer Portal' : 'SunPower Solar Operations'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowChangePassword(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              Change Password
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Active Role:</span>
              <Badge variant="warning" className="font-mono text-[11px] font-semibold">
                {user?.roles?.[0] || 'AUTHENTICATED'}
              </Badge>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>

      {/* Change Password Dialog */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </div>
  );
}

export default AppLayout;
