import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

/**
 * SearchableSelect / Combobox Component
 * Provides instant filtering, clean scrollable viewport-bounded lists,
 * and rich option formatting (labels, subtitles, badges) for large datasets.
 */
export function SearchableSelect({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  required = false,
  disabled = false,
  error = null,
  hint = null,
  className = '',
  maxListHeight = 'max-h-60',
  emptyMessage = 'No matching options found'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Selected Option Object
  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value)) || null;
  }, [options, value]);

  // Filtered Options based on query
  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const matchLabel = opt.label && String(opt.label).toLowerCase().includes(q);
      const matchSubtitle = opt.subtitle && String(opt.subtitle).toLowerCase().includes(q);
      const matchBadge = opt.badge && String(opt.badge).toLowerCase().includes(q);
      const matchSearchTerms = opt.searchTerms && String(opt.searchTerms).toLowerCase().includes(q);
      const matchValue = opt.value && String(opt.value).toLowerCase().includes(q);
      return matchLabel || matchSubtitle || matchBadge || matchSearchTerms || matchValue;
    });
  }, [options, searchQuery]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(-1);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
        scrollIndexIntoView(next);
        return next;
      });
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
        scrollIndexIntoView(next);
        return next;
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (filteredOptions.length === 1) {
        handleSelect(filteredOptions[0]);
      }
    }
  };

  const scrollIndexIntoView = (index) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-option-item]');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  const handleSelect = (option) => {
    onChange?.(option.value, option);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.('', null);
  };

  const getBadgeStyle = (variant) => {
    switch (variant) {
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'danger':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'info':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {label && (
        <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
          <span>{label}</span>
          {options.length > 0 && (
            <span className="text-[11px] text-slate-400 font-normal">
              {options.length} {options.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full text-left px-3 py-2 border rounded-lg text-sm bg-white flex items-center justify-between gap-2 transition-all ${
          disabled
            ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200'
            : error
            ? 'border-rose-300 focus:ring-2 focus:ring-rose-500'
            : isOpen
            ? 'border-midnight ring-2 ring-midnight/10'
            : 'border-slate-300 hover:border-slate-400 focus:ring-2 focus:ring-midnight'
        }`}
      >
        <div className="flex-1 min-w-0 pr-1">
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-900 truncate">
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0 ${getBadgeStyle(
                    selectedOption.badgeVariant
                  )}`}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 select-none truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {selectedOption && !required && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-midnight' : ''}`}
          />
        </div>
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animation-fadeIn">
          {/* Search Bar */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2 shrink-0">
            <Search className="w-4 h-4 text-slate-400 ml-1.5 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent border-0 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Result Count Status */}
          <div className="px-3 py-1 bg-slate-100/50 border-b border-slate-100 text-[10px] text-slate-500 font-mono flex items-center justify-between shrink-0">
            <span>
              {filteredOptions.length === options.length
                ? `Total ${options.length} records`
                : `Showing ${filteredOptions.length} of ${options.length}`}
            </span>
            {searchQuery && (
              <span className="text-slate-400">Filter: "{searchQuery}"</span>
            )}
          </div>

          {/* Options List */}
          <div ref={listRef} className={`${maxListHeight} overflow-y-auto divide-y divide-slate-100`}>
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 select-none">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    data-option-item
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2.5 cursor-pointer text-xs flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-amber-50/80 font-medium text-slate-900'
                        : isHighlighted
                        ? 'bg-slate-50 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 truncate">
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0 ${getBadgeStyle(
                              opt.badgeVariant
                            )}`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subtitle && (
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {opt.subtitle}
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-solar-gold shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
      {hint && !error && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default SearchableSelect;
