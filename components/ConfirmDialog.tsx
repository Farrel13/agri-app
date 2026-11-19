"use client";

import React, { useEffect, useRef, useId } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText = "Konfirmasi",
  cancelText = "Batal",
  isDanger = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleCancel = (e: React.SyntheticEvent) => {
    if (isLoading) {
      e.preventDefault();
      return;
    }
    onCancel();
  };

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = "";
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClose={handleClose}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="m-auto bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-sm p-5 space-y-4 backdrop:bg-black/40 backdrop:backdrop-blur-[2px] fixed inset-0"
    >
      <div className="space-y-1.5">
        <h3 id={titleId} className="text-base font-semibold text-gray-900 leading-snug">
          {title}
        </h3>
        <p id={descId} className="text-xs text-gray-500 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="flex gap-2.5 pt-1 justify-end">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          autoFocus={isDanger}
          className="px-3.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition cursor-pointer disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={`px-3.5 py-1.5 text-xs font-medium text-white rounded-md transition cursor-pointer disabled:opacity-50 ${
            isDanger
              ? "bg-rose-600 hover:bg-rose-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {isLoading ? "Memproses..." : confirmText}
        </button>
      </div>
    </dialog>
  );
}
