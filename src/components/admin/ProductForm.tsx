import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, X, Upload, Loader2, Image as ImageIcon } from 'lucide-react';

interface ProductFormData {
  id?: string;
  name: string;
  description: string;
  long_description: string;
  price: number;
  original_price: number | null;
  image_url: string;
  image_emoji: string;
  category: string;
  grade: string;
  year: number | null;
  language: string;
  card_count: number;
  benefits: string;
  in_stock: boolean;
  badge: string;
}

interface ProductFormProps {
  product?: any;
  onSave: () => void;
  onCancel: () => void;
}

const emptyProduct: ProductFormData = {
  name: '',
  description: '',
  long_description: '',
  price: 0,
  original_price: null,
  image_url: '',
  image_emoji: '📚',
  category: 'flashcards',
  grade: 'preparatory',
  year: null,
  language: 'english',
  card_count: 30,
  benefits: '',
  in_stock: true,
  badge: '',
};

export function ProductForm({ product, onSave, onCancel }: ProductFormProps) {
  const [form, setForm] = useState<ProductFormData>(emptyProduct);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    if (product) {
      setForm({
        id: product.id,
        name: product.name || '',
        description: product.description || '',
        long_description: product.long_description || '',
        price: product.price || 0,
        original_price: product.original_price || null,
        image_url: product.image_url || '',
        image_emoji: product.image_emoji || '📚',
        category: product.category || 'flashcards',
        grade: product.grade || 'preparatory',
        year: product.year || null,
        language: product.language || 'english',
        card_count: product.card_count || 30,
        benefits: product.benefits || '',
        in_stock: product.in_stock !== false,
        badge: product.badge || '',
      });
      if (product.image_url) setImagePreview(product.image_url);
    }
  }, [product]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setUploading(true);
    setError('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      setForm(prev => ({ ...prev, image_url: publicUrl }));
      setImagePreview(publicUrl);
    } catch (err: any) {
      setError('فشل رفع الصورة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase غير مُعدّ');
      return;
    }

    if (!form.name.trim() || form.price <= 0) {
      setError('يجب ملء اسم المنتج والسعر');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim(),
        long_description: form.long_description.trim(),
        price: form.price,
        original_price: form.original_price,
        image_url: form.image_url,
        image_emoji: form.image_emoji,
        category: form.category,
        grade: form.grade,
        year: form.year,
        language: form.language,
        card_count: form.card_count,
        benefits: form.benefits.trim(),
        in_stock: form.in_stock,
        badge: form.badge.trim(),
      };

      if (form.id) {
        const { error: updateError } = await supabase
          .from('products')
          .update(data)
          .eq('id', form.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('products')
          .insert(data);
        if (insertError) throw insertError;
      }

      onSave();
    } catch (err: any) {
      setError('فشل الحفظ: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof ProductFormData, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-3xl flex items-center justify-between z-10">
          <h2 className="text-xl font-black text-royal-900">
            {form.id ? '✏️ تعديل المنتج' : '➕ إضافة منتج جديد'}
          </h2>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">اسم المنتج *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="فلاش كاردز الحروف الإنجليزية - التحضيري"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">الوصف القصير</label>
            <textarea
              value={form.description}
              onChange={e => update('description', e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm resize-none"
            />
          </div>

          {/* Long Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">الوصف المفصّل</label>
            <textarea
              value={form.long_description}
              onChange={e => update('long_description', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm resize-none"
            />
          </div>

          {/* Price Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">السعر (د.ج) *</label>
              <input
                type="number"
                value={form.price}
                onChange={e => update('price', Number(e.target.value))}
                min={0}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">السعر الأصلي (اختياري)</label>
              <input
                type="number"
                value={form.original_price || ''}
                onChange={e => update('original_price', e.target.value ? Number(e.target.value) : null)}
                min={0}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm"
              />
            </div>
          </div>

          {/* Image Section */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">الصورة</label>
            <div className="grid grid-cols-2 gap-4">
              {/* Emoji */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">إيموجي (بديل)</label>
                <input
                  type="text"
                  value={form.image_emoji}
                  onChange={e => update('image_emoji', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-2xl text-center"
                />
              </div>

              {/* Upload */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">رفع صورة</label>
                <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-royal-400 cursor-pointer transition-all bg-gray-50 hover:bg-royal-50">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-royal-500" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-500">اختر صورة</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Preview */}
            {imagePreview && (
              <div className="mt-3 relative inline-block">
                <img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-xl border" />
                <button
                  type="button"
                  onClick={() => { setImagePreview(''); update('image_url', ''); }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>
            )}
            {!imagePreview && form.image_emoji && (
              <div className="mt-3 w-24 h-24 bg-royal-50 rounded-xl flex items-center justify-center text-5xl">
                {form.image_emoji}
              </div>
            )}
          </div>

          {/* Grade & Language Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">الطور</label>
              <select
                value={form.grade}
                onChange={e => update('grade', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm"
              >
                <option value="preparatory">التحضيري</option>
                <option value="elementary">الابتدائي</option>
                <option value="middle">المتوسط</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">السنة</label>
              <input
                type="number"
                value={form.year || ''}
                onChange={e => update('year', e.target.value ? Number(e.target.value) : null)}
                min={0}
                max={5}
                placeholder="0-5"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">اللغة</label>
              <select
                value={form.language}
                onChange={e => update('language', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm"
              >
                <option value="english">إنجليزية</option>
                <option value="french">فرنسية</option>
              </select>
            </div>
          </div>

          {/* Card Count & Badge */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">عدد البطاقات</label>
              <input
                type="number"
                value={form.card_count}
                onChange={e => update('card_count', Number(e.target.value))}
                min={1}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">شارة (اختياري)</label>
              <input
                type="text"
                value={form.badge}
                onChange={e => update('badge', e.target.value)}
                placeholder="الأكثر مبيعاً، جديد، عرض خاص..."
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm"
              />
            </div>
          </div>

          {/* Benefits */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              الفوائد <span className="text-gray-400 font-normal">(فائدة واحدة في كل سطر)</span>
            </label>
            <textarea
              value={form.benefits}
              onChange={e => update('benefits', e.target.value)}
              rows={3}
              placeholder="تسهيل شرح الحروف بصرياً&#10;تنظيم أنشطة تفاعلية&#10;توفير وقت التحضير"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm resize-none"
            />
          </div>

          {/* In Stock */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.in_stock}
              onChange={e => update('in_stock', e.target.checked)}
              className="w-5 h-5 rounded-lg text-royal-600"
              id="in_stock"
            />
            <label htmlFor="in_stock" className="text-sm font-semibold text-gray-700">متوفر في المخزون</label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-gradient-to-l from-royal-700 to-royal-600 hover:from-royal-600 hover:to-royal-500 disabled:from-gray-300 disabled:to-gray-300 text-white py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {form.id ? 'تحديث المنتج' : 'إضافة المنتج'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3.5 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
