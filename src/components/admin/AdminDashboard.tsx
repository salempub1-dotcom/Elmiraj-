import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Product } from '../../types';

export default function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [filterLang, setFilterLang] = useState<'all' | 'english' | 'french'>('all');
  const [message, setMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    description_short: '',
    description_long: '',
    price: 0,
    original_price: undefined,
    image_url: '',
    category: 'preparatory',
    language: 'english',
    grade: 'preparatory',
    year: undefined,
    card_count: 30,
    age_range: '',
    badge: '',
    is_active: true
  });

  const [imageFile, setImageFile] = useState<File | null>(null);

  // Check session
  useEffect(() => {
    console.log('🔍 AdminDashboard mounted');
    console.log('🔍 isSupabaseConfigured:', isSupabaseConfigured);
    
    if (!isSupabaseConfigured) {
      console.log('❌ Supabase NOT configured');
      setLoading(false);
      return;
    }

    supabase?.auth.getSession().then(({ data: { session } }) => {
      console.log('🔍 Session:', session ? 'Found' : 'Not found');
      setSession(session);
      if (session) fetchProducts();
      else setLoading(false);
    });

    supabase?.auth.onAuthStateChange((_event, session) => {
      console.log('🔍 Auth state changed:', _event);
      setSession(session);
      if (session) fetchProducts();
    });
  }, []);

  const fetchProducts = async () => {
    console.log('📥 Fetching products...');
    setLoading(true);
    
    if (!isSupabaseConfigured || !supabase) {
      console.log('❌ Cannot fetch: Supabase not configured');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('📥 Fetch result:', { data: data?.length, error });

    if (error) {
      console.error('❌ Fetch error:', error);
      setMessage('خطأ في جلب المنتجات: ' + error.message);
    } else {
      console.log('✅ Products loaded:', data?.length);
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔐 Attempting login...');
    setLoginError('');
    
    if (!supabase) {
      setLoginError('Supabase not configured');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    console.log('🔐 Login result:', { success: !!data.session, error });

    if (error) {
      setLoginError('البريد أو كلمة المرور غير صحيحة');
    } else {
      setSession(data.session);
    }
  };

  const handleLogout = async () => {
    console.log('🚪 Logging out...');
    await supabase?.auth.signOut();
    setSession(null);
    setProducts([]);
  };

  const handleImageUpload = async (file: File): Promise<string | null> => {
    console.log('📤 Uploading image:', file.name);
    setUploadingImage(true);
    
    if (!supabase) {
      console.log('❌ Cannot upload: Supabase not configured');
      setUploadingImage(false);
      return null;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);

    console.log('📤 Upload result:', { data, error });

    if (error) {
      console.error('❌ Upload error:', error);
      setMessage('خطأ في رفع الصورة: ' + error.message);
      setUploadingImage(false);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    console.log('✅ Image URL:', publicUrl);
    setUploadingImage(false);
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('💾 Submitting product...');
    console.log('💾 Form data:', formData);
    
    if (!supabase) {
      setMessage('Supabase not configured');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      let imageUrl = formData.image_url || '';

      if (imageFile) {
        console.log('💾 New image to upload');
        const uploadedUrl = await handleImageUpload(imageFile);
        if (uploadedUrl) imageUrl = uploadedUrl;
        else {
          setLoading(false);
          return;
        }
      }

      // Clean data - remove undefined values
      const cleanData: any = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          cleanData[key] = value;
        }
      });
      cleanData.image_url = imageUrl;

      console.log('📤 Sending to Supabase:', cleanData);

      let result;
      if (editingProduct) {
        console.log('📤 Updating product:', editingProduct.id);
        result = await supabase
          .from('products')
          .update(cleanData)
          .eq('id', editingProduct.id);
      } else {
        console.log('📤 Inserting new product');
        result = await supabase
          .from('products')
          .insert([cleanData]);
      }

      console.log('📤 Supabase result:', result);

      if (result.error) {
        console.error('❌ Supabase error:', result.error);
        setMessage('خطأ: ' + result.error.message);
      } else {
        console.log('✅ Saved successfully');
        setMessage(editingProduct ? 'تم التحديث!' : 'تمت الإضافة!');
        resetForm();
        fetchProducts();
        setShowForm(false);
      }
    } catch (err: any) {
      console.error('❌ Exception:', err);
      setMessage('خطأ غير متوقع: ' + err.message);
    }
    
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description_short: '',
      description_long: '',
      price: 0,
      original_price: undefined,
      image_url: '',
      category: 'preparatory',
      language: 'english',
      grade: 'preparatory',
      year: undefined,
      card_count: 30,
      age_range: '',
      badge: '',
      is_active: true
    });
    setImageFile(null);
    setEditingProduct(null);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData(product);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    
    console.log('🗑️ Deleting product:', id);
    setLoading(true);

    const { error } = await supabase!.from('products').delete().eq('id', id);
    
    console.log('🗑️ Delete result:', { error });

    if (error) {
      setMessage('خطأ في الحذف: ' + error.message);
    } else {
      setMessage('تم الحذف!');
      fetchProducts();
    }
    
    setLoading(false);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesLang = filterLang === 'all' || p.language === filterLang;
    return matchesSearch && matchesLang;
  });

  // Login screen
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#003429] to-[#001a14] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-[#003429] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#003429]">لوحة تحكم المعراج</h1>
            <p className="text-gray-500">تسجيل دخول المسؤول</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429] focus:border-transparent"
                required
              />
            </div>
            {loginError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{loginError}</div>
            )}
            <button
              type="submit"
              className="w-full bg-[#003429] text-white py-3 rounded-lg font-medium hover:bg-[#004d3d] transition-colors"
            >
              دخول
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-[#003429] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">لوحة تحكم المتجر</h1>
            <p className="text-sm text-[#c4a35a]">{session.user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
          >
            خروج
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div className="text-3xl font-bold text-[#003429]">{products.length}</div>
            <div className="text-sm text-gray-500">إجمالي المنتجات</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div className="text-3xl font-bold text-blue-600">
              {products.filter(p => p.language === 'english').length}
            </div>
            <div className="text-sm text-gray-500">إنجليزية</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div className="text-3xl font-bold text-purple-600">
              {products.filter(p => p.language === 'french').length}
            </div>
            <div className="text-sm text-gray-500">فرنسية</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <div className="text-3xl font-bold text-green-600">
              {products.filter(p => p.is_active).length}
            </div>
            <div className="text-sm text-gray-500">نشطة</div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.includes('خطأ') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {message}
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(true)}
                className="bg-[#003429] text-white px-4 py-2 rounded-lg hover:bg-[#004d3d] transition-colors flex items-center gap-2"
              >
                <span>+</span> منتج جديد
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="بحث..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429] focus:border-transparent"
              />
              <select
                value={filterLang}
                onChange={(e) => setFilterLang(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
              >
                <option value="all">كل اللغات</option>
                <option value="english">إنجليزية</option>
                <option value="french">فرنسية</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products Table */}
        {loading ? (
          <div className="text-center py-12">جاري التحميل...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">لا توجد منتجات</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right">الصورة</th>
                  <th className="px-4 py-3 text-right">الاسم</th>
                  <th className="px-4 py-3 text-right">السعر</th>
                  <th className="px-4 py-3 text-right">اللغة</th>
                  <th className="px-4 py-3 text-right">الحالة</th>
                  <th className="px-4 py-3 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-16 h-16 object-cover rounded-lg" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">لا صورة</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.category}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#003429]">{product.price} د.ج</div>
                      {product.original_price && (
                        <div className="text-sm text-gray-400 line-through">{product.original_price} د.ج</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-sm ${product.language === 'english' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {product.language === 'english' ? 'إنجليزية' : 'فرنسية'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-sm ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {product.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-[#003429]">
                {editingProduct ? 'تعديل منتج' : 'منتج جديد'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">وصف مختصر</label>
                  <input
                    type="text"
                    value={formData.description_short}
                    onChange={(e) => setFormData({...formData, description_short: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">وصف تفصيلي</label>
                  <textarea
                    value={formData.description_long}
                    onChange={(e) => setFormData({...formData, description_long: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429] h-24"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">السعر *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">السعر قبل الخصم</label>
                  <input
                    type="number"
                    value={formData.original_price || ''}
                    onChange={(e) => setFormData({...formData, original_price: e.target.value ? Number(e.target.value) : undefined})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الطور *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
                  >
                    <option value="preparatory">التحضيري</option>
                    <option value="primary">الابتدائي</option>
                    <option value="middle">المتوسط</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اللغة *</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({...formData, language: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
                  >
                    <option value="english">إنجليزية</option>
                    <option value="french">فرنسية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">السنة</label>
                  <select
                    value={formData.year || ''}
                    onChange={(e) => setFormData({...formData, year: e.target.value ? Number(e.target.value) : undefined})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
                  >
                    <option value="">بدون</option>
                    <option value="1">السنة 1</option>
                    <option value="2">السنة 2</option>
                    <option value="3">السنة 3</option>
                    <option value="4">السنة 4</option>
                    <option value="5">السنة 5</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">عدد البطاقات</label>
                  <input
                    type="number"
                    value={formData.card_count}
                    onChange={(e) => setFormData({...formData, card_count: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الفئة العمرية</label>
                  <input
                    type="text"
                    value={formData.age_range || ''}
                    onChange={(e) => setFormData({...formData, age_range: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]}"
                    placeholder="مثال: 4-6 سنوات"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الشارة</label>
                  <select
                    value={formData.badge || ''}
                    onChange={(e) => setFormData({...formData, badge: e.target.value || undefined})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
                  >
                    <option value="">بدون</option>
                    <option value="new">جديد</option>
                    <option value="bestseller">الأكثر مبيعاً</option>
                    <option value="sale">تخفيض</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">صورة المنتج</label>
                  <div className="flex gap-4 items-start">
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      {uploadingImage && <p className="text-sm text-blue-600 mt-1">جاري رفع الصورة...</p>}
                    </div>
                    {(imageFile || formData.image_url) && (
                      <div className="w-24 h-24">
                        <img
                          src={imageFile ? URL.createObjectURL(imageFile) : formData.image_url}
                          alt="معاينة"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="w-5 h-5 text-[#003429] rounded"
                  />
                  <label className="text-sm font-medium text-gray-700">منتج نشط</label>
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <button
                  type="submit"
                  disabled={loading || uploadingImage}
                  className="bg-[#003429] text-white px-6 py-2 rounded-lg hover:bg-[#004d3d] disabled:opacity-50"
                >
                  {loading ? 'جاري الحفظ...' : (editingProduct ? 'تحديث' : 'إضافة')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
