"use client";

import { useEffect, useState, useCallback } from "react";
import { OrderWithCoupon } from "@/types";
import { formatCurrency, formatDate, isExpired } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { ShoppingBag, AlertCircle, Eye } from "lucide-react";

export default function DashboardPage() {
  const [orders, setOrders] = useState<OrderWithCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Map<string, string>>(new Map());
  const [revealLoading, setRevealLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/orders");
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error("Failed to load orders");
        const data = await res.json();
        setOrders(data.orders ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error loading purchases");
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, []);

  const handleReveal = useCallback(async (coupon_id: string) => {
    if (revealedCodes.has(coupon_id)) return;
    setRevealLoading(coupon_id);
    try {
      const res = await fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupon_id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to reveal");
      }
      const data = await res.json();
      setRevealedCodes((prev) => new Map(prev).set(coupon_id, data.coupon_code));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to reveal coupon");
    } finally {
      setRevealLoading(null);
    }
  }, [revealedCodes]);

  const successOrders = orders.filter((o) => o.payment_status === "success");
  const pendingOrders = orders.filter((o) => o.payment_status === "pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-indigo-600" />
          My Purchases
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          View and reveal your purchased coupon codes.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-6">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {successOrders.length === 0 && pendingOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <ShoppingBag className="w-12 h-12" />
          <p className="font-medium">No purchases yet</p>
          <Button variant="outline" onClick={() => (window.location.href = "/")}>
            Browse Coupons
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {successOrders.map((order) => {
            const coupon = order.coupon;
            const revealed = revealedCodes.get(coupon.id);
            const isRevLoading = revealLoading === coupon.id;

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Brand logo placeholder */}
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold uppercase shrink-0">
                    {coupon.brand_name.slice(0, 2)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">
                        {coupon.brand_name}
                      </span>
                      <Badge variant="success">Purchased</Badge>
                      <Badge variant={isExpired(coupon.expiry_date) ? "danger" : "default"}>
                        {coupon.category}
                      </Badge>
                    </div>
                    <p className="text-gray-700 text-sm leading-snug">{coupon.title}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                      <span>Purchased: {formatDate(order.created_at)}</span>
                      <span>•</span>
                      <span>Valid till: {formatDate(coupon.expiry_date)}</span>
                      <span>•</span>
                      <span>{formatCurrency(order.amount)}</span>
                    </div>

                    {/* Revealed code */}
                    {revealed ? (
                      <div className="mt-3 flex items-center gap-3 flex-wrap">
                        <div className="bg-gray-50 border border-dashed border-indigo-200 rounded-xl px-4 py-2">
                          <p className="font-mono text-lg font-bold text-indigo-600 tracking-widest select-all">
                            {revealed}
                          </p>
                        </div>
                        <CopyButton text={revealed} label="Copy" />
                      </div>
                    ) : (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          loading={isRevLoading}
                          onClick={() => handleReveal(coupon.id)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Reveal Code
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {pendingOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden opacity-70"
            >
              <div className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-bold uppercase shrink-0">
                  {order.coupon?.brand_name?.slice(0, 2) ?? "??"}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">
                      {order.coupon?.brand_name}
                    </span>
                    <Badge variant="warning">Payment Pending</Badge>
                  </div>
                  <p className="text-gray-500 text-sm">
                    {order.coupon?.title}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
