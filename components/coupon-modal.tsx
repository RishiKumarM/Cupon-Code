"use client";

import { PublicCoupon } from "@/types";
import { formatCurrency, formatDate, isExpired } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  X,
  Lock,
  Calendar,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef } from "react";

interface CouponModalProps {
  coupon: PublicCoupon | null;
  onClose: () => void;
  onCheckout: (coupon: PublicCoupon) => void;
  checkoutLoading?: boolean;
}

export function CouponModal({
  coupon,
  onClose,
  onCheckout,
  checkoutLoading = false,
}: CouponModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll when modal open
  useEffect(() => {
    if (coupon) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [coupon]);

  if (!coupon) return null;

  const expired = isExpired(coupon.expiry_date);
  const sold = coupon.status === "sold";
  const canBuy = !expired && !sold;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold uppercase">
              {coupon.brand_name.slice(0, 2)}
            </div>
            <div>
              <h2
                id="modal-title"
                className="font-bold text-gray-900 leading-tight"
              >
                {coupon.brand_name}
              </h2>
              <Badge variant={sold ? "warning" : expired ? "danger" : "default"}>
                {coupon.category}
              </Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <h3 className="text-xl font-bold text-gray-900">{coupon.title}</h3>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
              <Calendar className="w-4 h-4" />
              <span>
                {expired ? "Expired on" : "Valid till"}{" "}
                {formatDate(coupon.expiry_date)}
              </span>
            </div>
          </div>

          {/* Locked code preview */}
          <div className="relative rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-5 flex flex-col items-center gap-2">
            <Lock className="w-8 h-8 text-indigo-400" />
            <span className="font-mono text-2xl font-bold text-gray-200 tracking-[0.3em] select-none">
              {coupon.masked_code}
            </span>
            <p className="text-sm text-indigo-600 font-medium text-center">
              Unlock the full coupon code after payment
            </p>
          </div>

          {/* Terms */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Terms &amp; Conditions
            </h4>
            <ul className="space-y-2">
              {coupon.terms_and_conditions.map((term, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{term}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
          {canBuy ? (
            <Button
              className="w-full"
              size="lg"
              loading={checkoutLoading}
              onClick={() => onCheckout(coupon)}
            >
              <Lock className="w-4 h-4" />
              Unlock Coupon Code for {formatCurrency(coupon.price)}
            </Button>
          ) : (
            <div className="text-center text-sm text-gray-400 font-medium py-2">
              {sold ? "This coupon has been sold out." : "This coupon has expired."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
