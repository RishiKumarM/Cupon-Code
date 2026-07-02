import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Tag } from "lucide-react";

export const metadata: Metadata = {
  title: "CouponCode — Premium Discount Codes",
  description:
    "Discover and unlock premium discount coupons from top brands. Pay a small fee to reveal the full coupon code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="bg-gray-50 min-h-full flex flex-col font-sans">
        {/* Navbar */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-indigo-600 font-bold text-lg"
            >
              <Tag className="w-5 h-5" />
              CouponCode
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-indigo-600 transition-colors"
              >
                My Purchases
              </Link>
              <Link
                href="/admin"
                className="text-gray-600 hover:text-indigo-600 transition-colors"
              >
                Admin
              </Link>
            </nav>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-gray-100 bg-white mt-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center text-sm text-gray-400">
            © {new Date().getFullYear()} CouponCode. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
