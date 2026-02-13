import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
const GRADES = [
  { value: 'preparatory', label: 'التحضيري' },
  { value: 'primary', label: 'الابتدائي' },
  { value: 'middle', label: 'المتوسط' },
];
const LANGUAGES = [
  { value: 'english', label: 'إنجليزية' },
  { value: 'french', label: 'فرنسية' },
];
const BADGES = [
  { value: '', label: 'بدون' },
  { value: 'جديد', label: 'جديد' },
  { value: 'الأكثر مبيعاً', label: 'الأكثر مبيعاً' },
  { value: 'خصم', label: 'خصم' },
];
const ALLOWED_FIELDS = [
  'name', 'description_short', 'description_long',
  'price', 'original_price', 'image_url',
  'category', 'language', 'grade', 'year',
  'card_count', 'age_range', 'badge', 'is_active'
];
interface Product {
  id: string;
  name: string;
  description_short: string;
  description_long: string;
  price: number;
  original_price: number | null;
  image_url: string;
  category: string;
  language: string;
  grade: string;
  year: number | null;
  card_count: number;
  age_range: string;
  badge: string;
  is_active: boolean;
}
const emptyProduct = {
  name: '',
  description_short: '',
  description_long: '',
  price: 0,
  original_price: null as number | null,
  image_url: '',
  category: 'preparatory',
  language: 'english',
  grade: 'preparatory',
  year: null as number | null,
  card_count: 30,
  age_range: '',
  badge: '',
  is_active: true,
};
export default function AdminDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  useEffect(() => {
    checkAuth();
  }, []);
  async function checkAuth() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      setIsLoggedIn(true);
      loadProducts();
    }
  }
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setLoginError('Supabase غير متصل');
      return;
    }
    setLoginLoading(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoginError('بريد إلكتروني أو كلمة مرور خاطئة');
    } else {
      setIsLoggedIn(true);
      loadProducts();
    }
    setLoginLoading(false);
  }
  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setIsLoggedIn(false);
  }
  async function loadProducts() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setProducts(data);
    setLoading(false);
  }
  function showMsg(text: string, type: string) {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  }
  function openAdd() {
    setForm(emptyProduct);
    setEditingId(null);
    setImageFile(null);
    setImagePreview('');
    setShowForm(true);
  }
  function openEdit(p: Product) {
    setForm({
      name: p.name || '',
      description_short: p.description_short || '',
      description_long: p.description_long || '',
      price: p.price || 0,
      original_price: p.original_price,
      image_url: p.image_url || '',
      category: p.category || 'preparatory',
      language: p.language || 'english',
      grade: p.grade || 'preparatory',
      year: p.year,
      card_count: p.card_count || 30,
      age_range: p.age_range || '',
      badge: p.badge || '',
      is_active: p.is_active !== false,
    });
    setEditingId(p.id);
    setImageFile(null);
    setImagePreview(p.image_url || '');
    setShowForm(true);
  }
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }
  async function uploadImage(file: File): Promise<string> {
    if (!supabase) throw new Error('Supabase غير متصل');
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);
    return data.publicUrl;
  }
  function cleanData(data: any) {
    const clean: any = {};
    for (const key of ALLOWED_FIELDS) {
      if (data[key] !== undefined) {
        clean[key] = data[key];
      }
    }
    return clean;
  }
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!form.name || !form.price) {
      showMsg('الاسم والسعر مطلوبان', 'error');
      return;
    }
    setSaving(true);
    try {
      let imageUrl = form.image_url;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }
      const productData = cleanData({
        name: form.name,
        description_short: form.description_short,
        description_long: form.description_long,
        price: Number(form.price),
        original_price: form.original_price ? Number(form.original_price) : null,
        image_url: imageUrl,
        category: form.category,
        language: form.language,
        grade: form.grade,
        year: form.year ? Number(form.year) : null,
        card_count: Number(form.card_count) || 30,
        age_range: form.age_range,
        badge: form.badge,
        is_active: form.is_active,
      });
      console.log('Saving product data:', productData);
      let error;
      if (editingId) {
        const result = await supabase.from('products').update(productData).eq('id', editingId);
        error = result.error;
      } else {
        const result = await supabase.from('products').insert([productData]);
        error = result.error;
      }
      if (error) {
        console.error('Supabase error:', error);
        showMsg('فشل الحفظ: ' + error.message, 'error');
      } else {
        showMsg(editingId ? 'تم تعديل المنتج بنجاح' : 'تم إضافة المنتج بنجاح', 'success');
        setShowForm(false);
        loadProducts();
      }
    } catch (err: any) {
      console.error('Save error:', err);
      showMsg('خطأ: ' + err.message, 'error');
    }
    setSaving(false);
  }
  async function handleDelete() {
    if (!supabase || !deleteId) return;
    const { error } = await supabase.from('products').delete().eq('id', deleteId);
    if (error) {
      showMsg('فشل الحذف: ' + error.message, 'error');
    } else {
      showMsg('تم حذف المنتج', 'success');
      loadProducts();
    }
    setDeleteId(null);
  }
  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );
  // LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <div dir="rtl" style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '40px', maxWidth: '400px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ width: '60px', height: '60px', background: '#003429', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px', fontSize: '24px' }}>🔐</div>
            <h2 style={{ color: '#003429', fontSize: '24px', margin: 0 }}>لوحة تحكم المعراج</h2>
            <p style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>تسجيل دخول المدير</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontSize: '14px' }}>البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '12px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}
                placeholder="admin@example.com"
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: '#333', fontSize: '14px' }}>كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '12px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}
                placeholder="••••••••"
              />
            </div>
            {loginError && (
              <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px', textAlign: 'center' }}>
                {loginError}
              </div>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              style={{ width: '100%', padding: '14px', background: '#003429', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', opacity: loginLoading ? 0.7 : 1 }}
            >
              {loginLoading ? 'جاري الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    );
  }
  // MAIN DASHBOARD
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Tajawal, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#003429', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>📦</span>
          <h1 style={{ fontSize: '18px', margin: 0 }}>لوحة تحكم المعراج</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => { window.location.hash = ''; window.location.reload(); }} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
            🏠 المتجر
          </button>
          <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
            خروج
          </button>
        </div>
      </div>
      {/* Message */}
      {message.text && (
        <div style={{ padding: '12px 20px', background: message.type === 'success' ? '#dcfce7' : '#fee2e2', color: message.type === 'success' ? '#16a34a' : '#dc2626', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
          {message.text}
        </div>
      )}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#003429' }}>{products.length}</div>
            <div style={{ color: '#666', fontSize: '14px' }}>إجمالي المنتجات</div>
          </div>
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2563eb' }}>{products.filter(p => p.language === 'english').length}</div>
            <div style={{ color: '#666', fontSize: '14px' }}>🇬🇧 إنجليزية</div>
          </div>
          <div style={{ background: 'white', padding: '20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc2626' }}>{products.filter(p => p.language === 'french').length}</div>
            <div style={{ color: '#666', fontSize: '14px' }}>🇫🇷 فرنسية</div>
          </div>
        </div>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={openAdd} style={{ padding: '12px 24px', background: '#003429', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ➕ إضافة منتج جديد
          </button>
          <input
            type="text"
            placeholder="🔍 بحث..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '12px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px' }}
          />
        </div>
        {/* Loading */}
        {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>جاري التحميل...</div>}
        {/* Products Grid */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {filtered.map(p => (
              <div key={p.id} style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '180px', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>📦</div>
                )}
                <div style={{ padding: '15px' }}>
                  <h3 style={{ margin: '0 0 5px', fontSize: '16px', color: '#003429' }}>{p.name}</h3>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#666' }}>{p.description_short}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#003429' }}>{p.price} د.ج</span>
                    <span style={{ fontSize: '12px', padding: '2px 8px', background: p.language === 'english' ? '#dbeafe' : '#fce7f3', color: p.language === 'english' ? '#2563eb' : '#db2777', borderRadius: '4px' }}>
                      {p.language === 'english' ? '🇬🇧 EN' : '🇫🇷 FR'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => openEdit(p)} style={{ flex: 1, padding: '8px', background: '#f0fdf4', color: '#003429', border: '1px solid #003429', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      ✏️ تعديل
                    </button>
                    <button onClick={() => setDeleteId(p.id)} style={{ flex: 1, padding: '8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #dc2626', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      🗑️ حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>📦</div>
            <p>لا توجد منتجات بعد. اضغط "إضافة منتج جديد" للبدء.</p>
          </div>
        )}
      </div>
      {/* ADD/EDIT FORM MODAL */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '30px' }} dir="rtl">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#003429', fontSize: '20px' }}>
                {editingId ? '✏️ تعديل المنتج' : '➕ إضافة منتج جديد'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#999' }}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              {/* Name */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#333' }}>اسم المنتج *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              {/* Short desc */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#333' }}>وصف مختصر</label>
                <input value={form.description_short} onChange={e => setForm({ ...form, description_short: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              {/* Long desc */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#333' }}>وصف تفصيلي</label>
                <textarea value={form.description_long} onChange={e => setForm({ ...form, description_long: e.target.value })} rows={3} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              {/* Price row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#333' }}>السعر (د.ج) *</label>
                  <input type="number" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} required style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#333' }}>السعر قبل الخصم</label>
                  <input type="number" value={form.original_price || ''} onChange={e => setForm({ ...form, original_price: e.target.value ? Number(e.target.value) : null })} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
              </div>
              {/* Grade & Language */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#333' }}>الطور</label>
                  <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value, category: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}>
                    {GRADES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#333' }}>اللغة</label>
                  <select value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}>
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              {/* Year & Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#333' }}>السنة</label>
                  <input type="number" value={form.year || ''} onChange={e => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })} placeholder="مثال: 3" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#333' }}>عدد البطاقات</label>
                  <input type="number" value={form.card_count} onChange={e => setForm({ ...form, card_count: Number(e.target.value) })} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
              </div>
              {/* Age & Badge */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#333' }}>الفئة العمرية</label>
                  <input value={form.age_range} onChange={e => setForm({ ...form, age_range: e.target.value })} placeholder="مثال: 5-6 سنوات" style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#333' }}>الشارة</label>
                  <select value={form.badge} onChange={e => setForm({ ...form, badge: e.target.value })} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}>
                    {BADGES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
              </div>
              {/* Image */}
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#333' }}>صورة المنتج</label>
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                {imagePreview && (
                  <img src={imagePreview} alt="معاينة" style={{ marginTop: '10px', maxHeight: '150px', borderRadius: '8px', objectFit: 'cover' }} />
                )}
              </div>
              {/* Active */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  <span style={{ fontSize: '14px' }}>منتج نشط (مرئي في المتجر)</span>
                </label>
              </div>
              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={saving} style={{ flex: 1, padding: '14px', background: '#003429', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'جاري الحفظ...' : editingId ? '💾 حفظ التعديلات' : '➕ إضافة المنتج'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '14px 24px', background: '#f3f4f6', color: '#333', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' }}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DELETE CONFIRM */}
      {deleteId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '30px', maxWidth: '400px', width: '90%', textAlign: 'center' }} dir="rtl">
            <div style={{ fontSize: '48px', marginBottom: '15px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 10px', color: '#333' }}>تأكيد الحذف</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleDelete} style={{ flex: 1, padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                نعم، احذف
              </button>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: '12px', background: '#f3f4f6', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
