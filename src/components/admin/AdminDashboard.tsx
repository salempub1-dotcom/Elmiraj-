import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Product } from '../../types';

// الأعمدة الأساسية فقط - المؤكد وجودها
const BASIC_FIELDS = ['name', 'description', 'price', 'image_url', 'category', 'language'];

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
  const [message, setMessage] = useState('');

  // Form state - بسيط جداً
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    image_url: '',
    category: 'preparatory',
    language: 'english'
  });

  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase?.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProducts();
      else setLoading(false);
    });

    supabase?.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProducts();
    });
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setMessage('خطأ في جلب المنتجات: ' + error.message);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    if (!supabase) {
      setLoginError('Supabase not configured');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setLoginError('البريد أو كلمة المرور غير صحيحة');
    } else {
      setSession(data.session);
    }
  };

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setProducts([]);
  };

  const handleImageUpload = async (file: File): Promise<string | null> => {
    if (!supabase) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);

    if (error) {
      setMessage('خطأ في رفع الصورة: ' + error.message);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabase) {
      setMessage('Supabase not configured');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      let imageUrl = formData.image_url;

      if (imageFile) {
        const uploadedUrl = await handleImageUpload(imageFile);
        if (uploadedUrl) imageUrl = uploadedUrl;
        else {
          setLoading(false);
          return;
        }
      }

      // بيانات بسيطة فقط
      const dataToSend = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        image_url: imageUrl,
        category: formData.category,
        language: formData.language
      };

      let result;
      if (editingProduct) {
        result = await supabase
          .from('products')
          .update(dataToSend)
          .eq('id', editingProduct.id);
      } else {
        result = await supabase
          .from('products')
          .insert([dataToSend]);
      }

      if (result.error) {
        setMessage('خطأ: ' + result.error.message);
      } else {
        setMessage(editingProduct ? 'تم التحديث!' : 'تمت الإضافة!');
        resetForm();
        fetchProducts();
        setShowForm(false);
      }
    } catch (err: any) {
      setMessage('خطأ غير متوقع: ' + err.message);
    }
    
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      image_url: '',
      category: 'preparatory',
      language: 'english'
    });
    setImageFile(null);
    setEditingProduct(null);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price,
      image_url: product.image_url || '',
      category: product.category,
      language: product.language
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    
    setLoading(true);
    const { error } = await supabase!.from('products').delete().eq('id', id);
    
    if (error) {
      setMessage('خطأ في الحذف: ' + error.message);
    } else {
      setMessage('تم الحذف!');
      fetchProducts();
    }
    setLoading(false);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

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
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
                required
              />
            </div>
            {loginError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{loginError}</div>
            )}
            <button
              type="submit"
              className="w-full bg-[#003429] text-white py-3 rounded-lg font-medium hover:bg-[#004d3d]"
            >
              دخول
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-[#003429] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">لوحة تحكم المتجر</h1>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg"
          >
            خروج
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.includes('خطأ') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {message}
          </div>
        )}

        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-wrap gap-4 justify-between">
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#003429] text-white px-4 py-2 rounded-lg hover:bg-[#004d3d]"
          >
            + منتج جديد
          </button>
          <input
            type="text"
            placeholder="بحث..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

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
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">لا صورة</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.category} • {product.language}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#003429]">{product.price} د.ج</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(product)} className="text-blue-600 hover:text-blue-800">تعديل</button>
                        <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-800">حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-[#003429]">
                {editingProduct ? 'تعديل منتج' : 'منتج جديد'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429] h-20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">صورة المنتج</label>
                <div className="flex gap-4 items-start">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  {(imageFile || formData.image_url) && (
                    <img
                      src={imageFile ? URL.createObjectURL(imageFile) : formData.image_url}
                      alt="معاينة"
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <button
                  type="submit"
                  disabled={loading}
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
