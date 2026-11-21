import React, { useRef } from 'react';
import { Loader2 } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled = false,
  icon: Icon,
  className = '',
  onClick,
  throttleMs = 400,
  ...props
}) {
  const lastClickRef = useRef(0);

  const handleClick = (e) => {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }

    if (onClick) {
      const now = Date.now();
      if (throttleMs > 0 && now - lastClickRef.current < throttleMs) {
        e.preventDefault();
        return;
      }
      lastClickRef.current = now;
      onClick(e);
    }
  };

  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary: 'bg-midnight text-white hover:bg-midnight-light focus:ring-midnight shadow-sm',
    accent: 'bg-solar-gold text-midnight font-semibold hover:bg-solar-gold-dark focus:ring-solar-gold shadow-sm',
    green: 'bg-solar-green text-white hover:bg-solar-green-dark focus:ring-solar-green shadow-sm',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-300',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500 shadow-sm'
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5'
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={handleClick}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children}
    </button>
  );
}

export default Button;
