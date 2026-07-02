"use client";

import { useCallback, useEffect, useState } from "react";
import { CouponCard } from "@/components/coupon-card";
import { CouponModal } from "@/components/coupon-modal";
import { SearchFilter } from "@/components/search-filter";
import { PublicCoupon } from "@/types";
import { Tag, AlertCircle } from "lucide-react";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

export default function BrowsePage() {
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [selectedCoupon, setSelectedCoupon] = useState<PublicCoupon | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (selectedCategory !== "All") params.set("category", selectedCategory);

    try {
      const res = await fetch(`/api/coupons?${params}`);
      if (!res.ok) throw new Error("Failed to load coupons");
      const data = await res.json();
      setCoupons(data.coupons ?? []);
      setCategories(data.categories ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    const timer = setTimeout(fetchCoupons, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchCoupons, search]);

  const handleCheckout = useCallback(async (coupon: PublicCoupon) => {
    setCheckoutLoading(true);

    try {
      // Create Razorpay order
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupon_id: coupon.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        // If not authenticated, redirect to Supabase login
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error(err.error ?? "Failed to create order");
      }

      const orderData = await res.json();

      // Load Razorpay script dynamically
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.head.appendChild(script);
        });
      }

      const rzp = new window.Razorpay({
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.razorpay_order_id,
        name: "CouponCode",
        description: coupon.title,
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          // Redirect to success page with payment details
          const params = new URLSearchParams({
            order_id: orderData.order_id,
            coupon_id: coupon.id,
            payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            signature: response.razorpay_signature,
          });
          window.location.href = `/success?${params}`;
        },
        prefill: {},
        theme: { color: "#4f46e5" },
      });

      setCheckoutLoading(false);
      rzp.open();
    } catch (e) {
      setCheckoutLoading(false);
      alert(e instanceof Error ? e.message : "Checkout failed");
    }
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
          <Tag className="w-4 h-4" />
          Premium Coupon Marketplace
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-3">
          Unlock Exclusive Deals
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto">
          Browse premium discount coupons from top brands. Pay a small fee to
          reveal the full coupon code.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8">
        <SearchFilter
          search={search}
          onSearchChange={setSearch}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </div>

      {/* Coupon Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 h-64 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <AlertCircle className="w-10 h-10" />
          <p className="font-medium">{error}</p>
        </div>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <Tag className="w-10 h-10" />
          <p className="font-medium">No coupons found</p>
          <p className="text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {coupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              onViewDetails={setSelectedCoupon}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <CouponModal
        coupon={selectedCoupon}
        onClose={() => setSelectedCoupon(null)}
        onCheckout={handleCheckout}
        checkoutLoading={checkoutLoading}
      />
    </div>
  );
}
