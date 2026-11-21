import React from 'react';

export function MetricCard({ title, value, unit = '', trend, subtitle, icon: Icon, iconColor = 'text-solar-gold' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{title}</span>
        {Icon && (
          <div className={`p-2.5 rounded-lg bg-slate-50 ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono text-midnight tracking-tight">
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-slate-500">{unit}</span>}
      </div>

      {(trend || subtitle) && (
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          {trend && (
            <span className={`font-semibold px-1.5 py-0.5 rounded ${
              trend.startsWith('+') ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600 bg-slate-100'
            }`}>
              {trend}
            </span>
          )}
          {subtitle && <span className="text-slate-500">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}

export default MetricCard;
