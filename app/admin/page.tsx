"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Plus, X, CheckCircle, AlertCircle } from "lucide-react";

const CATEGORIES = [
  "Flights",
  "Hotels",
  "Fashion",
  "Electronics",
  "Eyewear",
  "Food",
  "Skincare",
  "Other",
];

interface FormState {
  brand_name: string;
  category: string;
  title: string;
  expiry_date: string;
  price: string;
  coupon_code: string;
  term: string;
  terms_and_conditions: string[];
}

export default function AdminPage() {
  const [form, setForm] = useState<FormState>({
    brand_name: "",
    category: "Flights",
    title: "",
    expiry_date: "",
    price: "",
    coupon_code: "",
    term: "",
    terms_and_conditions: [],
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTerm = () => {
    if (!form.term.trim()) return;
    setForm((f) => ({
      ...f,
      terms_and_conditions: [...f.terms_and_conditions, f.term.trim()],
      term: "",
    }));
  };

  const removeTerm = (i: number) => {
    setForm((f) => ({
      ...f,
      terms_and_conditions: f.terms_and_conditions.filter((_, idx) => idx !== i),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) {
      setError("Price must be a positive number");
      setSubmitting(false);
      return;
    }

    if (form.terms_and_conditions.length === 0) {
      setError("Add at least one term & condition");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: form.brand_name,
          category: form.category,
          title: form.title,
          expiry_date: form.expiry_date,
          price,
          coupon_code: form.coupon_code,
          terms_and_conditions: form.terms_and_conditions,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (res.status === 403) {
          setError("Access denied — admin only");
          return;
        }
        const err = await res.json();
        throw new Error(JSON.stringify(err.error));
      }

      setSuccess(true);
      setForm({
        brand_name: "",
        category: "Flights",
        title: "",
        expiry_date: "",
        price: "",
        coupon_code: "",
        term: "",
        terms_and_conditions: [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create coupon");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-600" />
          Admin — Add Coupon
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Add a new coupon to the marketplace. The secret code will be encrypted
          before storage.
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1.5 rounded-lg">
          <Shield className="w-3.5 h-3.5" />
          Requires admin role. Ensure you are signed in with an admin account.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Brand Name"
            placeholder="e.g. ixigo"
            required
            value={form.brand_name}
            onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="Deal Title"
          placeholder="e.g. Up to ₹6000 off on flights"
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Expiry Date"
            type="date"
            required
            value={form.expiry_date}
            onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
          />
          <Input
            label="Price (₹)"
            type="number"
            placeholder="e.g. 49"
            min="1"
            step="0.01"
            required
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </div>

        {/* Secret coupon code — sensitive field */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Secret Coupon Code{" "}
            <span className="text-xs text-indigo-500 font-normal">
              (encrypted before saving)
            </span>
          </label>
          <input
            type="password"
            placeholder="e.g. IXIGO2024DEAL"
            required
            value={form.coupon_code}
            onChange={(e) => setForm((f) => ({ ...f, coupon_code: e.target.value }))}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            autoComplete="off"
          />
        </div>

        {/* Terms */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Terms &amp; Conditions
          </label>
          {form.terms_and_conditions.map((term, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg text-sm"
            >
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="flex-1">{term}</span>
              <button
                type="button"
                onClick={() => removeTerm(i)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a term…"
              value={form.term}
              onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTerm();
                }
              }}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button type="button" variant="outline" size="sm" onClick={addTerm}>
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>

        {/* Feedback */}
        {success && (
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <p className="text-sm font-medium">Coupon created successfully!</p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-3 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <Button type="submit" loading={submitting} className="w-full" size="lg">
          <Plus className="w-4 h-4" />
          Create Coupon
        </Button>
      </form>
    </div>
  );
}
