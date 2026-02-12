import { useState } from 'react';
import { ShoppingCart, Menu, X, Search, Package } from 'lucide-react';
import { Logo } from './Logo';
import { useCart } from '../context/CartContext';

interface HeaderProps {
  onNavigate: (view: string, grade?: string) => void;
  currentView: string;
}

export function Header({ onNavigate, currentView }: HeaderProps) {
  const { totalItems, setIsCartOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const navItems = [
    { label: 'الرئيسية', view: 'home' },
    { label: 'المنتجات', view: 'products' },
    { label: 'رياض الأطفال', view: 'products', grade: 'kindergarten' },
    { label: 'الابتدائية', view: 'products', grade: 'elementary' },
    { label: 'المتوسطة', view: 'products', grade: 'middle' },
    { label: '📦 تتبع الطلب', view: 'tracking' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-royal-100">
      {/* Top bar */}
      <div className="bg-gradient-to-l from-royal-800 via-royal-700 to-royal-800 text-white py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
          <span className="flex items-center gap-1">
            🧑‍🏫 وسائل تعليمية لأساتذة الإنجليزية والفرنسية 🇩🇿 | الدفع عند الاستلام
          </span>
          <span className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => onNavigate('tracking')}
              className="flex items-center gap-1 hover:text-gold-300 transition-colors"
            >
              <Package className="w-3 h-3" />
              تتبع طلبك
            </button>
            <span>|</span>
            <span>📞 0555-XX-XX-XX</span>
          </span>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <button onClick={() => onNavigate('home')} className="flex-shrink-0 hover:opacity-90 transition-opacity">
            <Logo size="sm" />
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  onNavigate(item.view, item.grade);
                  setMobileMenuOpen(false);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentView === item.view && !item.grade
                    ? 'bg-royal-50 text-royal-700'
                    : 'text-gray-600 hover:bg-royal-50 hover:text-royal-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2.5 rounded-xl text-gray-500 hover:bg-royal-50 hover:text-royal-600 transition-all"
            >
              <Search className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-xl text-gray-500 hover:bg-royal-50 hover:text-royal-600 transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -left-1 bg-gold-500 text-royal-900 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-scale-in">
                  {totalItems}
                </span>
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl text-gray-500 hover:bg-royal-50 hover:text-royal-600 transition-all"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="mt-3 animate-fade-in-up">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="ابحث عن المنتجات التعليمية..."
                className="w-full pr-10 pl-4 py-3 rounded-xl border border-royal-200 focus:border-royal-500 focus:ring-2 focus:ring-royal-200 outline-none transition-all text-sm"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-royal-100 bg-white animate-fade-in-up">
          <nav className="max-w-7xl mx-auto px-4 py-3 space-y-1">
            {navItems.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  onNavigate(item.view, item.grade);
                  setMobileMenuOpen(false);
                }}
                className="block w-full text-right px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-royal-50 hover:text-royal-700 transition-all"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
