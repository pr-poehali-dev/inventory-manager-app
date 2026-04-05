import { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';

export type AutocompleteOption = {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (option: AutocompleteOption) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  allowCustom?: boolean;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
};

export default function Autocomplete({
  value,
  onChange,
  onSelect,
  options,
  placeholder = 'Начните вводить...',
  allowCustom = true,
  className = '',
  disabled = false,
  clearable = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter(o =>
    value.trim() === '' || o.label.toLowerCase().includes(value.toLowerCase()) ||
    o.sublabel?.toLowerCase().includes(value.toLowerCase())
  ).slice(0, 8);

  const showDropdown = open && (filtered.length > 0 || (allowCustom && value.trim().length > 0));

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'ArrowDown') { setOpen(true); return; }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) {
        onSelect(filtered[highlighted]);
        onChange(filtered[highlighted].label);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [showDropdown, filtered, highlighted, onSelect, onChange]);

  const handleSelect = (opt: AutocompleteOption) => {
    onSelect(opt);
    onChange(opt.label);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    onSelect({ id: '', label: '' });
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full h-9 pl-8 pr-8 text-sm rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          onChange={e => { onChange(e.target.value); setOpen(true); setHighlighted(0); }}
          onFocus={() => { setOpen(true); setHighlighted(0); }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {clearable && value && (
          <button
            type="button"
            onMouseDown={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="X" size={13} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          ref={listRef}
          className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-scale-in"
        >
          {filtered.length > 0 ? (
            <div className="py-1">
              {filtered.map((opt, i) => (
                <button
                  key={opt.id}
                  type="button"
                  onMouseDown={() => handleSelect(opt)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors
                    ${i === highlighted ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">{opt.label}</div>
                    {opt.sublabel && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{opt.sublabel}</div>
                    )}
                  </div>
                  {opt.badge && (
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={opt.badgeColor
                        ? { backgroundColor: opt.badgeColor + '20', color: opt.badgeColor }
                        : undefined}
                    >
                      {opt.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : null}

          {allowCustom && value.trim() && !filtered.find(o => o.label.toLowerCase() === value.toLowerCase()) && (
            <div className="border-t border-border">
              <button
                type="button"
                onMouseDown={() => {
                  onSelect({ id: '__new__', label: value.trim() });
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-primary"
              >
                <Icon name="Plus" size={14} />
                <span>Добавить «<b>{value.trim()}</b>»</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
