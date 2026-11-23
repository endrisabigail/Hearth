import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, animate, useReducedMotion } from "motion/react";
import Icon from "./Icon.jsx";
import { sfx } from "../../lib/sound.js";

export function Button({ variant = "default", size = "md", icon, children, className = "", loading, ...rest }) {
  return (
    <button className={`btn btn--${variant} btn--${size} ${loading ? "is-loading" : ""} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ icon, label, badge, className = "", size = 20, ...rest }) {
  return (
    <button className={`icon-btn ${className}`} aria-label={label} data-tip={label} {...rest}>
      <Icon name={icon} size={size} />
      <AnimatePresence>
        {badge ? (
          <motion.span className="icon-btn__badge" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
            {badge > 9 ? "9+" : badge}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  );
}

export function Modal({ open, onClose, children, className = "", side = "center", label, wide }) {
  const reduce = useReducedMotion();
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.activeElement;
    const raf = requestAnimationFrame(() => {
      const p = panelRef.current;
      const target = p?.querySelector("[data-autofocus]") || p?.querySelector("input, textarea") || p?.querySelector("button");
      target?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const variants =
    side === "right"
      ? { initial: { x: reduce ? 0 : 60, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: reduce ? 0 : 60, opacity: 0 } }
      : { initial: { y: reduce ? 0 : 24, scale: reduce ? 1 : 0.96, opacity: 0 }, animate: { y: 0, scale: 1, opacity: 1 }, exit: { y: reduce ? 0 : 16, scale: reduce ? 1 : 0.97, opacity: 0 } };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className={`modal-layer modal-layer--${side}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={`modal sticker ${wide ? "modal--wide" : ""} modal--${side} ${className}`}
            {...variants}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ModalHeader({ title, onClose, onBack, children }) {
  return (
    <header className="modal__head">
      {onBack && <IconButton icon="back" label="Back" onClick={onBack} className="icon-btn--flat" />}
      <h2 className="modal__title">{title}</h2>
      <div className="modal__head-extra">{children}</div>
      {onClose && <IconButton icon="close" label="Close" onClick={onClose} className="icon-btn--flat" />}
    </header>
  );
}

const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-3), { id, msg, tone: opts.tone || "info", icon: opts.icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div key={t.id} layout className={`toast sticker toast--${t.tone}`} initial={{ y: -20, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -12, opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
              {t.icon && <span className="toast__icon">{t.icon}</span>}
              <span>{t.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

export function AnimatedNumber({ value, className = "" }) {
  const ref = useRef(null);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (!ref.current) return;
    if (from === value) {
      ref.current.textContent = value;
      return;
    }
    const controls = animate(from, value, {
      duration: 0.9,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = Math.round(v);
      },
    });
    return () => controls.stop();
  }, [value]);
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}

export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function Segmented({ options, value, onChange, className = "" }) {
  return (
    <div className={`segmented ${className}`} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={`segmented__opt ${value === o.value ? "is-on" : ""}`}
          onClick={() => {
            sfx("click", 0.6);
            onChange(o.value);
          }}
          style={o.color ? { "--opt": o.color } : undefined}
        >
          {value === o.value && <motion.span layoutId={`seg-${className}`} className="segmented__pill" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          <span className="segmented__label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </label>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`field ${className}`}>
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function EmptyState({ emoji, title, children }) {
  return (
    <div className="empty">
      <div className="empty__emoji" aria-hidden="true">{emoji}</div>
      <p className="empty__title">{title}</p>
      {children && <div className="empty__body">{children}</div>}
    </div>
  );
}
