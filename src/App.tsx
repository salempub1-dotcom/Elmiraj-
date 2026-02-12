import { useState, useMemo, useCallback } from 'react';
import { CartProvider, useCart } from './context/CartContext';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import Categories from './components/Categories';
import { FeaturedProducts } from './components/FeaturedProducts';
import { ProductCard } from './components/ProductCard';
import { ProductModal } from './components/ProductModal';
import { CartSidebar } from './components/CartSidebar';
import { Benefits } from './components/Benefits';
import { Testimonials } from './components/Testimonials';
import { Footer } from './components/Footer';
import { Checkout } from './components/Checkout';
import { OrderTracking } from './components/OrderTracking';
import { Product } from './types';
import { products, grades } from './data/products';
import { Filter, X, ArrowRight } from 'lucide-react';

function AppContent() {
  const [currentView, setCurrentView] = useState('home');
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { addToCart, clearCart } = useCart();

  const navigate = (view: string, grade?: string, year?: number) => {
    setCurrentView(view);
    if (grade) {
      setSelectedGrade(grade);
      setSelectedYear(year ?? null);
    } else if (view === 'products') {
      setSelectedGrade(null);
      setSelectedYear(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Buy Now: clear cart, add the product, go to checkout
  const handleBuyNow = useCallback((product: Product, quantity: number = 1) => {
    clearCart();
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
    setSelectedProduct(null);
    setCurrentView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [addToCart, clearCart]);

  // Buy Now from card (quantity = 1)
  const handleBuyNowFromCard = useCallback((product: Product) => {
    handleBuyNow(product, 1);
  }, [handleBuyNow]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedGrade && p.grade !== selectedGrade) return false;
      if (selectedYear && p.year !== selectedYear) return false;
      if (selectedLanguage && p.language !== selectedLanguage) return false;
      return true;
    });
  }, [selectedGrade, selectedYear, selectedLanguage]);

  const currentGrade = grades.find(g => g.id === selectedGrade);
  const currentYear = currentGrade?.years.find(y => y.year === selectedYear);

  const availableYears = useMemo(() => {
    if (!currentGrade) return [];
    return currentGrade.years;
  }, [currentGrade]);

  const getYearLabel = () => {
    if (!currentGrade) return 'جميع المنتجات';
    if (currentYear) {
      return `${currentGrade.name} — ${currentYear.label}`;
    }
    return `جميع وسائل ${currentGrade.name}`;
  };

  const getGradeIcon = () => {
    if (!currentGrade) return '📦';
    return currentGrade.icon;
  };

  return (
    <div className="min-h-screen bg-white">
      <Header onNavigate={navigate} currentView={currentView} />
      <CartSidebar onCheckout={() => navigate('checkout')} />
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onBuyNow={handleBuyNow}
        />
      )}

      {currentView === 'home' && (
        <>
          <Hero onNavigate={navigate} />
          <Categories onSelectGrade={(grade: string, year?: number) => navigate('products', grade, year)} />
          <FeaturedProducts
            onViewDetails={setSelectedProduct}
            onViewAll={() => navigate('products')}
            onBuyNow={handleBuyNowFromCard}
          />
          <Benefits />
          
          {/* CTA Section */}
          <section className="py-20">
            <div className="max-w-7xl mx-auto px-4">
              <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-bl from-royal-800 via-royal-700 to-royal-900 p-10 md:p-16">
                <div className="absolute top-0 left-0 w-72 h-72 bg-gold-400/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-royal-400/10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />
                
                <div className="relative text-center max-w-2xl mx-auto space-y-6">
                  <div className="text-5xl mb-4">🧑‍🏫</div>
                  <h2 className="text-3xl md:text-4xl font-black text-white">
                    طوّر حصصك بوسائل تعليمية احترافية
                  </h2>
                  <p className="text-royal-100/70 max-w-lg mx-auto">
                    اختر من مجموعتنا الواسعة من الفلاش كاردز المصممة خصيصاً لأساتذة اللغة الإنجليزية والفرنسية
                  </p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <button
                      onClick={() => navigate('products')}
                      className="bg-gradient-to-l from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-royal-900 font-bold px-8 py-4 rounded-2xl transition-all shadow-lg hover:-translate-y-0.5"
                    >
                      تصفح المنتجات
                    </button>
                    <button
                      onClick={() => navigate('tracking')}
                      className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white font-bold px-8 py-4 rounded-2xl border border-white/20 transition-all hover:-translate-y-0.5"
                    >
                      📦 تتبع طلبك
                    </button>
                  </div>
                  <div className="flex flex-wrap justify-center gap-6 text-sm text-white/70 pt-4">
                    <span className="flex items-center gap-2">💰 الدفع عند الاستلام</span>
                    <span className="flex items-center gap-2">🚚 توصيل Noest لـ 58 ولاية</span>
                    <span className="flex items-center gap-2">🎁 توصيل مجاني +5000 د.ج</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Testimonials />
        </>
      )}

      {currentView === 'products' && (
        <section className="py-10">
          <div className="max-w-7xl mx-auto px-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
              <button onClick={() => navigate('home')} className="hover:text-royal-600 transition-colors">الرئيسية</button>
              {currentGrade && (
                <>
                  <span>/</span>
                  <button
                    onClick={() => { setSelectedYear(null); }}
                    className={`hover:text-royal-600 transition-colors ${!currentYear ? 'text-royal-700 font-medium' : ''}`}
                  >
                    {currentGrade.name}
                  </button>
                </>
              )}
              {currentYear && (
                <>
                  <span>/</span>
                  <span className="text-royal-700 font-medium">{currentYear.label}</span>
                </>
              )}
              {!currentGrade && (
                <>
                  <span>/</span>
                  <span className="text-royal-700 font-medium">جميع المنتجات</span>
                </>
              )}
            </div>

            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-black text-royal-900 mb-2">
                <span className="flex items-center gap-3">
                  <span className="text-4xl">{getGradeIcon()}</span>
                  {getYearLabel()}
                </span>
              </h1>
              {currentGrade && (
                <p className="text-gray-500">{currentGrade.description}</p>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Filter className="w-4 h-4" />
                <span>تصفية:</span>
              </div>

              {/* Grade Filter */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setSelectedGrade(null); setSelectedYear(null); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    !selectedGrade
                      ? 'bg-royal-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-royal-50 hover:text-royal-600'
                  }`}
                >
                  الكل
                </button>
                {grades.map(grade => (
                  <button
                    key={grade.id}
                    onClick={() => { setSelectedGrade(selectedGrade === grade.id ? null : grade.id); setSelectedYear(null); }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedGrade === grade.id
                        ? 'bg-royal-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-royal-50 hover:text-royal-600'
                    }`}
                  >
                    {grade.icon} {grade.name}
                  </button>
                ))}
              </div>

              {/* Year Filter */}
              {currentGrade && availableYears.length > 1 && (
                <>
                  <div className="w-px h-6 bg-gray-200 hidden sm:block" />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedYear(null)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        !selectedYear
                          ? 'bg-royal-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-royal-50 hover:text-royal-600'
                      }`}
                    >
                      كل السنوات
                    </button>
                    {availableYears.map(yr => (
                      <button
                        key={yr.year}
                        onClick={() => setSelectedYear(selectedYear === yr.year ? null : yr.year)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          selectedYear === yr.year
                            ? 'bg-royal-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-royal-50 hover:text-royal-600'
                        }`}
                      >
                        {yr.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="w-px h-6 bg-gray-200 hidden sm:block" />

              {/* Language Filter */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: null, label: 'كل اللغات' },
                  { id: 'english', label: '🇬🇧 إنجليزي' },
                  { id: 'french', label: '🇫🇷 فرنسي' },
                ].map(lang => (
                  <button
                    key={lang.id || 'all'}
                    onClick={() => setSelectedLanguage(lang.id === selectedLanguage ? null : lang.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedLanguage === lang.id
                        ? 'bg-gold-500 text-royal-900 shadow-md'
                        : 'bg-gray-100 text-gray-600 hover:bg-gold-50 hover:text-gold-700'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              {/* Clear Filters */}
              {(selectedGrade || selectedLanguage || selectedYear) && (
                <button
                  onClick={() => { setSelectedGrade(null); setSelectedYear(null); setSelectedLanguage(null); }}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                >
                  <X className="w-3 h-3" />
                  إزالة الفلاتر
                </button>
              )}
            </div>

            {/* Results count */}
            <p className="text-sm text-gray-500 mb-6">
              عرض {filteredProducts.length} منتج
            </p>

            {/* Products Grid */}
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((product, i) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onViewDetails={setSelectedProduct}
                    onBuyNow={handleBuyNowFromCard}
                    index={i}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 space-y-4">
                <div className="text-5xl">🔍</div>
                <h3 className="text-xl font-bold text-gray-400">لا توجد منتجات مطابقة</h3>
                <p className="text-sm text-gray-400">جرب تغيير معايير البحث</p>
                <button
                  onClick={() => { setSelectedGrade(null); setSelectedYear(null); setSelectedLanguage(null); }}
                  className="text-royal-600 font-medium hover:underline text-sm"
                >
                  عرض جميع المنتجات
                </button>
              </div>
            )}

            {/* Back to top */}
            <div className="text-center mt-12">
              <button
                onClick={() => navigate('home')}
                className="inline-flex items-center gap-2 text-royal-600 hover:text-royal-700 font-medium transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة للرئيسية</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {currentView === 'checkout' && (
        <Checkout onBack={() => navigate('home')} />
      )}

      {currentView === 'tracking' && (
        <OrderTracking onBack={() => navigate('home')} />
      )}

      <Footer onNavigate={navigate} />
    </div>
  );
}

export function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}
