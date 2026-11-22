import React from 'react';

const VARIANT_MAP = {
  // Stages & Statuses
  NEW: 'bg-sky-50 text-sky-700 border-sky-200',
  CONTACTED: 'bg-amber-50 text-amber-700 border-amber-200',
  QUALIFIED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SURVEY_SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
  SURVEY_APPROVED: 'bg-teal-50 text-teal-700 border-teal-200',
  QUOTATION_SENT: 'bg-purple-50 text-purple-700 border-purple-200',
  NEGOTIATION: 'bg-orange-50 text-orange-700 border-orange-200',
  WON: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  LOST: 'bg-rose-50 text-rose-700 border-rose-200',

  // Semantics
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200'
};

export function Badge({ children, variant = 'neutral', size = 'sm', className = '' }) {
  const style = VARIANT_MAP[variant] || VARIANT_MAP.neutral;
  const sizeClasses = size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span className={`inline-flex items-center justify-center font-medium rounded-full border whitespace-nowrap shrink-0 select-none ${style} ${sizeClasses} ${className}`}>
      {children}
    </span>
  );
}

export default Badge;
