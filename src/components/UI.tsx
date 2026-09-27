import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import {
  X,
  FlaskConical,
  PenLine,
  Usb,
  Info,
  ArrowUpRight,
} from "lucide-react";
import type { Reading } from "../lib/model";
import { sourceLabel, statusLabel } from "../lib/model";
export function SourceBadge({ reading }: { reading: Reading }) {
  const Icon =
    reading.source === "demo"
      ? FlaskConical
      : reading.source === "device"
        ? Usb
        : PenLine;
  return (
    <span className={`badge ${reading.source}`}>
      <Icon size={12} aria-hidden="true" />
      {sourceLabel[reading.source]}
    </span>
  );
}
export function StatusBadge({ reading }: { reading: Reading }) {
  return (
    <span className={`status ${reading.status}`}>
      {statusLabel[reading.status]}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose(): void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2 id={id}>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "error" | "success";
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : undefined}
    >
      <Info size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
export function Empty({
  title = "A fresh start",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <FlaskConical size={26} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick(): void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} aria-hidden="true" />
    </button>
  );
}
