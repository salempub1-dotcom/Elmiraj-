import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Product } from '../../types';

// Order type
interface Order {
  id: string;
  customerName: string;
  phone: string;
  wilaya: string;
  total: number;
  status: 'new' | 'processing' | 'shipped' | 'delivered';
  date: string;
  items: { name: string; quantity: number; price: number }[];
}

export default function AdminDashboard() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Tabs: dashboard, products, orders
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders'>('dashboard');
  
  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchProduct, setSearchProduct] = useState('');
  const [message, setMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [searchOrder, setSearchOrder] = useState('');
  const [orderFilter, setOrderFilter] = useState<'all' | 'new' | 'processing' | 'shipped'>('all');
  
  // Form state
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
      setLoadingProducts(false);
      setLoadingOrders(false);
      return;
    }

    supabase?.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProducts();
        loadOrders();
      } else {
        setLoadingProducts(false);
        setLoadingOrders(false);
      }
    });

    supabase?.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProducts();
        loadOrders();
      }
    });
  }, []);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    if (!supabase) { setLoadingProducts(false); return; }
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) setMessage('خطأ في جلب المنتجات: ' + error.message);
    else setProducts(data || []);
    
    setLoadingProducts(false);
  };

  const loadOrders = () => {
    setLoadingOrders(true);
    const saved = localStorage.getItem('elmiraj_orders');
    if (saved) {
      try {
        setOrders(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading orders:', e);
      }
    }
    setLoadingOrders(false);
  };

  const saveOrders = (newOrders: Order[]) => {
    setOrders(newOrders);
    localStorage.setItem('elmiraj_orders', JSON.stringify(newOrders));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!supabase) { setLoginError('Supabase not configured'); return; }
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('البريد أو كلمة المرور غير صحيحة');
    else setSession(data.session);
  };

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setProducts([]);
    setOrders([]);
  };

  const handleImageUpload = async (file: File): Promise<string | null> => {
    if (!supabase) return null;
    setUploadingImage(true);
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);
    
    if (uploadError) {
      setMessage('خطأ في رفع الصورة: ' + uploadError.message);
      setUploadingImage(false);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);
    
    setUploadingImage(false);
    return publicUrl;
  };

  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) { setMessage('Supabase not configured'); return; }
    
    setLoadingProducts(true);
    setMessage('');
    
    try {
      let imageUrl = formData.image_url;
      if (imageFile) {
        const uploaded = await handleImageUpload(imageFile);
        if (uploaded) imageUrl = uploaded;
        else { setLoadingProducts(false); return; }
      }
      
      const dataToSend = { ...formData, image_url: imageUrl };
      
      let result;
      if (editingProduct) {
        result = await supabase.from('products').update(dataToSend).eq('id', editingProduct.id);
      } else {
        result = await supabase.from('products').insert([dataToSend]);
      }
      
      if (result.error) setMessage('خطأ: ' + result.error.message);
      else {
        setMessage(editingProduct ? 'تم التحديث!' : 'تمت الإضافة!');
        resetForm();
        fetchProducts();
        setShowProductForm(false);
      }
    } catch (err: any) {
      setMessage('خطأ غير متوقع: ' + err.message);
    }
    setLoadingProducts(false);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', price: 0, image_url: '', category: 'preparatory', language: 'english' });
    setImageFile(null);
    setEditingProduct(null);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price,
      image_url: product.image_url || '',
      category: product.category,
      language: product.language
    });
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    setLoadingProducts(true);
    const { error } = await supabase!.from('products').delete().eq('id', id);
    if (error) setMessage('خطأ في الحذف: ' + error.message);
    else { setMessage('تم الحذف!'); fetchProducts(); }
    setLoadingProducts(false);
  };

  const updateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    const updated = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    saveOrders(updated);
  };

  // Stats
  const totalProducts = products.length;
  const totalOrders = orders.length;
  const newOrders = orders.filter(o => o.status === 'new').length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.customerName.toLowerCase().includes(searchOrder.toLowerCase()) || 
                         o.id.toLowerCase().includes(searchOrder.toLowerCase());
    const matchesFilter = orderFilter === 'all' || o.status === orderFilter;
    return matchesSearch && matchesFilter;
  });

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
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]" required />
            </div>
            {loginError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{loginError}</div>}
            <button type="submit" className="w-full bg-[#003429] text-white py-3 rounded-lg font-medium hover:bg-[#004d3d]">دخول</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      {/* Header */}
      <header className="bg-[#003429] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">لوحة تحكم المتجر</h1>
            <span className="text-sm text-[#c4a35a]">| {session.user?.email}</span>
          </div>
          <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg">خروج</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          {[
            { id: 'dashboard', label: '📊 لوحة المعلومات' },
            { id: 'products', label: '📦 المنتجات' },
            { id: 'orders', label: `📋 الطلبات ${newOrders > 0 ? `(${newOrders})` : ''}` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'border-[#003429] text-[#003429]' 
                  : 'border-transparent text-gray-600 hover:text-[#003429]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.includes('خطأ') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {message}
          </div>
        )}

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="text-4xl font-bold text-[#003429]">{totalProducts}</div>
                <div className="text-gray-500">إجمالي المنتجات</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="text-4xl font-bold text-blue-600">{totalOrders}</div>
                <div className="text-gray-500">إجمالي الطلبات</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm relative">
                <div className="text-4xl font-bold text-red-600">{newOrders}</div>
                <div className="text-gray-500">طلبات جديدة</div>
                {newOrders > 0 && <span className="absolute top-4 right-4 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>}
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="text-4xl font-bold text-green-600">{totalRevenue.toLocaleString()}</div>
                <div className="text-gray-500">إجمالي المبيعات (د.ج)</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="font-bold text-lg mb-4">آخر الطلبات</h3>
                {orders.slice(0, 5).map(order => (
                  <div key={order.id} className="flex justify-between items-center py-3 border-b last:border-0">
                    <div>
                      <div className="font-medium">{order.customerName}</div>
                      <div className="text-sm text-gray-500">{order.id}</div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold">{order.total} د.ج</div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        order.status === 'new' ? 'bg-red-100 text-red-700' :
                        order.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {order.status === 'new' ? 'جديد' :
                         order.status === 'processing' ? 'قيد التجهيز' :
                         order.status === 'shipped' ? 'مُرسل' : 'مُسلَّم'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="font-bold text-lg mb-4">اختصارات سريعة</h3>
                <div className="space-y-3">
                  <button onClick={() => setActiveTab('products')} className="w-full text-right p-4 bg-gray-50 hover:bg-gray-100 rounded-lg flex justify-between items-center">
                    <span>إضافة منتج جديد</span>
                    <span>→</span>
                  </button>
                  <button onClick={() => setActiveTab('orders')} className="w-full text-right p-4 bg-gray-50 hover:bg-gray-100 rounded-lg flex justify-between items-center">
                    <span>عرض الطلبات الجديدة</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 justify-between">
              <button onClick={() => setShowProductForm(true)} className="bg-[#003429] text-white px-4 py-2 rounded-lg hover:bg-[#004d3d]">
                + منتج جديد
              </button>
              <input type="text" placeholder="بحث في المنتجات..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            {loadingProducts ? (
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
                      <th className="px-4 py-3 text-right">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(product => (
                      <tr key={product.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-16 h-16 object-cover rounded-lg" />
                          ) : (
                            <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400">لا صورة</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.category}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-[#003429]">{product.price} د.ج</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-sm ${product.language === 'english' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {product.language === 'english' ? 'إنجليزية' : 'فرنسية'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => handleEditProduct(product)} className="text-blue-600 hover:text-blue-800">تعديل</button>
                            <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800">حذف</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-4 justify-between">
              <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value as any)} className="px-4 py-2 border border-gray-300 rounded-lg">
                <option value="all">كل الطلبات</option>
                <option value="new">جديدة</option>
                <option value="processing">قيد التجهيز</option>
                <option value="shipped">مُرسلة</option>
              </select>
              <input type="text" placeholder="بحث برقم الطلب أو اسم الزبون..." value={searchOrder} onChange={(e) => setSearchOrder(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            {loadingOrders ? (
              <div className="text-center py-12">جاري التحميل...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">لا توجد طلبات</div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-right">رقم الطلب</th>
                      <th className="px-4 py-3 text-right">الزبون</th>
                      <th className="px-4 py-3 text-right">المبلغ</th>
                      <th className="px-4 py-3 text-right">الحالة</th>
                      <th className="px-4 py-3 text-right">التاريخ</th>
                      <th className="px-4 py-3 text-right">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(order => (
                      <tr key={order.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{order.id}</td>
                        <td className="px-4 py-3">
                          <div>{order.customerName}</div>
                          <div className="text-sm text-gray-500">{order.wilaya}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-[#003429]">{order.total.toLocaleString()} د.ج</td>
                        <td className="px-4 py-3">
                          <select
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                            className={`px-2 py-1 rounded text-sm border-0 ${
                              order.status === 'new' ? 'bg-red-100 text-red-700' :
                              order.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                              order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                              'bg-green-100 text-green-700'
                            }`}
                          >
                            <option value="new">جديد</option>
                            <option value="processing">قيد التجهيز</option>
                            <option value="shipped">مُرسل</option>
                            <option value="delivered">مُسلَّم</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(order.date).toLocaleDateString('ar-DZ')}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => alert(`تفاصيل الطلب:\n\nالزبون: ${order.customerName}\nالهاتف: ${order.phone}\nالولاية: ${order.wilaya}\n\nالمنتجات:\n${order.items.map(i => `- ${i.name} (${i.quantity} × ${i.price} د.ج)`).join('\n')}\n\nالإجمالي: ${order.total} د.ج`)} className="text-blue-600 hover:text-blue-800">عرض</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Product Form Modal */}
      {showProductForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-[#003429]">{editingProduct ? 'تعديل منتج' : 'منتج جديد'}</h2>
            </div>
            <form onSubmit={handleSubmitProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429] h-20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">السعر *</label>
                  <input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اللغة *</label>
                  <select value={formData.language} onChange={(e) => setFormData({...formData, language: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]">
                    <option value="english">إنجليزية</option>
                    <option value="french">فرنسية</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الطور *</label>
                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#003429]">
                  <option value="preparatory">التحضيري</option>
                  <option value="primary">الابتدائي</option>
                  <option value="middle">المتوسط</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">صورة المنتج</label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                {uploadingImage && <p className="text-sm text-blue-600 mt-1">جاري الرفع...</p>}
                {(imageFile || formData.image_url) && (
                  <img src={imageFile ? URL.createObjectURL(imageFile) : formData.image_url} alt="معاينة" className="mt-2 w-24 h-24 object-cover rounded-lg" />
                )}
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <button type="submit" disabled={loadingProducts || uploadingImage} className="bg-[#003429] text-white px-6 py-2 rounded-lg hover:bg-[#004d3d] disabled:opacity-50">
                  {loadingProducts ? 'جاري...' : (editingProduct ? 'تحديث' : 'إضافة')}
                </button>
                <button type="button" onClick={() => { setShowProductForm(false); resetForm(); }} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
