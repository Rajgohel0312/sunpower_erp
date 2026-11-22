import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sun, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Button from '../../components/common/Button.jsx';

export function LoginPage() {
  const [email, setEmail] = useState('admin@sunpower.com');
  const [password, setPassword] = useState('SunPower@Admin2026');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await login(email.trim().toLowerCase(), password);
      if (res?.user?.roles?.includes('CUSTOMER')) {
        navigate('/portal');
      } else {
        navigate('/');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-midnight flex items-center justify-center text-solar-gold shadow-lg shadow-midnight/20">
            <Sun className="w-8 h-8 fill-solar-gold" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-midnight font-display">
          SunPower ERP & Customer Portal
        </h2>
        <p className="mt-1 text-center text-xs font-mono uppercase tracking-widest text-slate-500">
          Solar Project Lifecycle, Invoicing & Self-Service
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-200/80">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Email Address
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@sunpower.com or customer@domain.com"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-midnight focus:border-midnight"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-midnight focus:border-midnight font-mono"
                />
              </div>
            </div>

            <Button
              type="submit"
              loading={submitting}
              className="w-full justify-center py-2.5 text-sm font-semibold"
            >
              Sign In to SunPower
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          {/* Quick Demo Credentials Fill */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-2">
              Default Super Admin:
            </span>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-600 flex justify-between items-center">
              <div>
                <div>admin@sunpower.com</div>
                <div className="text-slate-400">SunPower@Admin2026</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@sunpower.com');
                  setPassword('SunPower@Admin2026');
                }}
                className="text-midnight font-bold hover:underline text-[11px]"
              >
                Auto-Fill
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
