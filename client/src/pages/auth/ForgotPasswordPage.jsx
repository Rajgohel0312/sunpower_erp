import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Mail, ArrowLeft, CheckCircle2, AlertCircle, ArrowRight, KeyRound } from 'lucide-react';
import { apiRequest } from '../../api/client.js';
import Button from '../../components/common/Button.jsx';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devResetToken, setDevResetToken] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });

      setSubmitted(true);
      if (res.data?.devResetToken) {
        setDevResetToken(res.data.devResetToken);
      }
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred while processing your request.');
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
          Forgot Password
        </h2>
        <p className="mt-1 text-center text-xs font-mono uppercase tracking-widest text-slate-500">
          SunPower Customer & Staff Account Recovery
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

          {submitted ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Instructions Dispatched</h4>
                  <p className="text-xs text-emerald-700 mt-1">
                    If an account is associated with <strong>{email}</strong>, password reset instructions and a secure recovery link have been sent.
                  </p>
                </div>
              </div>

              {/* Dev Mode Instant Reset Link */}
              {devResetToken && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <KeyRound className="w-4 h-4 text-amber-600" />
                    Local Development Recovery Link
                  </div>
                  <p className="text-[11px] text-amber-700 font-mono break-all">
                    Token: {devResetToken}
                  </p>
                  <Link
                    to={`/reset-password?token=${devResetToken}`}
                    className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-200/70 hover:bg-amber-200 px-3 py-1.5 rounded-lg text-xs transition-colors"
                  >
                    Open Reset Password Form &rarr;
                  </Link>
                </div>
              )}

              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full py-2.5 px-4 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <p className="text-xs text-slate-600">
                Enter your registered email address and we'll send you instructions to securely reset your password.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Registered Email Address
                </label>
                <div className="mt-1 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@domain.com"
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-midnight focus:border-midnight"
                  />
                </div>
              </div>

              <Button
                type="submit"
                loading={submitting}
                className="w-full justify-center py-2.5 text-sm font-semibold"
              >
                Send Reset Instructions
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>

              <div className="pt-2 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-midnight transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Remember your password? Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
