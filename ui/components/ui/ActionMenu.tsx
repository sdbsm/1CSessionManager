import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

export type ActionMenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
};

interface ActionMenuProps {
  items: ActionMenuItem[];
  align?: 'left' | 'right';
  ariaLabel?: string;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  align = 'right',
  ariaLabel = 'Открыть меню действий'
}) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const visibleItems = useMemo(() => items.filter(Boolean), [items]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (visibleItems.length === 0) return null;

  return (
    <div className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        className={`p-2 rounded-md transition-colors border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 ${open ? 'ring-1 ring-indigo-500/40' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        title="Действия"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(v => !v);
        }}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          className={`absolute top-full mt-2 min-w-[200px] rounded-xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden z-20 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {visibleItems.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                it.variant === 'danger'
                  ? 'text-rose-200 hover:bg-rose-500/10'
                  : 'text-slate-200 hover:bg-white/5'
              }`}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


