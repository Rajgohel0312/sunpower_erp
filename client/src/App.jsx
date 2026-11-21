import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { LeadsListPage } from './pages/leads/LeadsListPage';
import { LeadDetailPage } from './pages/leads/LeadDetailPage';
import { CustomersListPage } from './pages/customers/CustomersListPage';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';
import { UsersListPage } from './pages/users/UsersListPage';
import { SurveysListPage } from './pages/surveys/SurveysListPage';
import { SurveyDetailPage } from './pages/surveys/SurveyDetailPage';
import { CatalogPage } from './pages/catalog/CatalogPage';
import { QuotationsListPage } from './pages/quotations/QuotationsListPage';
import { QuotationDetailPage } from './pages/quotations/QuotationDetailPage';
import { OrdersListPage } from './pages/orders/OrdersListPage';
import { OrderDetailPage } from './pages/orders/OrderDetailPage';

// Auth Guard Wrapper
const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-solar-gold border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500 font-display">Loading SunPower ERP...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

// Public Route Guard (redirects already logged-in users away from /login)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          {/* Authenticated ERP Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/leads" element={<LeadsListPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/customers" element={<CustomersListPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/surveys" element={<SurveysListPage />} />
            <Route path="/surveys/:id" element={<SurveyDetailPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/quotations" element={<QuotationsListPage />} />
            <Route path="/quotations/:id" element={<QuotationDetailPage />} />
            <Route path="/orders" element={<OrdersListPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/users" element={<UsersListPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
