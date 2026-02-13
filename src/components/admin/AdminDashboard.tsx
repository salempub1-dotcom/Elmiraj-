import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ProductForm } from './ProductForm';
import { AdminLogin } from './AdminLogin';
import {
  Plus, LogOut, Loader2, Pencil, Trash2, Package,
  LayoutDashboard, RefreshCw, AlertTriangle, Search
} from 'lucide-react';
import { Logo } from '../Logo';

interface AdminDashboardProps {
  onExit: () => void;
}

export function AdminDashboard({ onExit }: AdminDashboardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ total: 0, english: 0, french: 0 });

  // Check authentication on mount
  useEffect(() => {
    if (!supabase) {
      setCheckingAuth(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setCheckingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
      setStats({
        total: data?.length || 0,
        english: data?.filter((p: any) => p.language === 'english').length || 0,
        french: data?.filter((p: any) => p.language === 'french').length || 0,
      });
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchProducts();
  }, [isAuthenticated, fetchProducts]);

  // Delete product
  const handleDelete = async (id: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setDeleteConfirm(null);
      fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  // Logout
  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    setIsAuthenticated(false);
    onExit();
  };

  // Filter products
  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const gradeLabels: Record<string, string> = {
    preparatory: '🌱 التحضيري',
    elementary: '📘 الابتدائي',
    middle: '🎓 المتوسط',
  };

  const languageLabels: Record<string, string> = {
    english: '🇬🇧 إنجليزي',
    french: '🇫🇷 فرنسي',
  };

  // Loading state
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-royal-600" />
      </div>
    );
  }

  // Not configured
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg max-w-md w-full p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-black text-gray-800">Supabase غير مُعدّ</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            لتفعيل لوحة التحكم، أضف متغيرات البيئة التالية في Vercel:
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left text-xs font-mono space-y-1" dir="ltr">
            <p className="text-royal-600">VITE_SUPABASE_URL=https://xxx.supabase.co</p>
            <p className="text-royal-600">VITE_SUPABASE_ANON_KEY=eyJhbGci...</p>
          </div>
          <button
            onClick={onExit}
            className="bg-royal-600 hover:bg-royal-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
          >
            العودة للمتجر
          </button>
        </div>
      </div>
    );
  }

  // Login screen
  if (!isAuthenticated) {
    return <AdminLogin onLogin={() => setIsAuthenticated(true)} />;
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Product Form Modal */}
      {showForm && (
        <ProductForm
          product={editProduct}
          onSave={() => { setShowForm(false); setEditProduct(null); fetchProducts(); }}
          onCancel={() => { setShowForm(false); setEditProduct(null); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4 animate-scale-in">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">حذف المنتج؟</h3>
            <p className="text-sm text-gray-500">هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold transition-all"
              >
                نعم، احذف
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            <div className="hidden sm:flex items-center gap-2 bg-royal-50 text-royal-700 px-3 py-1.5 rounded-lg text-sm font-bold">
              <LayoutDashboard className="w-4 h-4" />
              لوحة التحكم
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onExit}
              className="text-sm text-gray-500 hover:text-royal-600 px-3 py-2 rounded-lg transition-colors"
            >
              🏪 المتجر
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-all"
            >
              <LogOut className="w-4 h-4" />
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">إجمالي المنتجات</p>
                <p className="text-3xl font-black text-royal-700 mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-royal-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-royal-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">إنجليزية</p>
                <p className="text-3xl font-black text-blue-600 mt-1">{stats.english}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">🇬🇧</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">فرنسية</p>
                <p className="text-3xl font-black text-purple-600 mt-1">{stats.french}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">🇫🇷</div>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="البحث عن منتج..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-royal-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchProducts}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </button>
            <button
              onClick={() => { setEditProduct(null); setShowForm(true); }}
              className="flex items-center gap-2 bg-royal-600 hover:bg-royal-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              إضافة منتج
            </button>
          </div>
        </div>

        {/* Products List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-royal-600" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-5xl">📦</div>
            <h3 className="text-xl font-bold text-gray-400">
              {searchQuery ? 'لا توجد نتائج' : 'لا توجد منتجات بعد'}
            </h3>
            <p className="text-sm text-gray-400">
              {searchQuery ? 'جرب كلمات بحث مختلفة' : 'أضف أول منتج لمتجرك'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => { setEditProduct(null); setShowForm(true); }}
                className="bg-royal-600 hover:bg-royal-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
              >
                ➕ إضافة أول منتج
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 hover:shadow-md transition-all group"
              >
                {/* Image */}
                <div className="w-16 h-16 bg-royal-50 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span className="text-3xl">{product.image_emoji || '📦'}</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-royal-900 line-clamp-1">{product.name}</h4>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs bg-royal-50 text-royal-700 px-2 py-0.5 rounded-lg font-medium">
                      {gradeLabels[product.grade] || product.grade}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg font-medium">
                      {languageLabels[product.language] || product.language}
                    </span>
                    {product.year && (
                      <span className="text-xs text-gray-400">السنة {product.year}</span>
                    )}
                    {product.badge && (
                      <span className="text-xs bg-gold-100 text-gold-700 px-2 py-0.5 rounded-lg font-medium">
                        {product.badge}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="text-left flex-shrink-0">
                  <p className="font-black text-royal-700">{product.price} د.ج</p>
                  {product.original_price && (
                    <p className="text-xs text-gray-400 line-through">{product.original_price} د.ج</p>
                  )}
                </div>

                {/* Stock Status */}
                <div className="flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${product.in_stock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {product.in_stock ? 'متوفر' : 'غير متوفر'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditProduct(product); setShowForm(true); }}
                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                    title="تعديل"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(product.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
