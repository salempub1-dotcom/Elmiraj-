import { X, ShoppingCart, Star, Check, Minus, Plus } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useState } from 'react';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const languageLabel = {
    english: 'إنجليزي',
    french: 'فرنسي',
    both: 'ثنائي اللغة (إنجليزي + فرنسي)'
  };

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur-sm hover:bg-gray-100 p-2 rounded-xl transition-all"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <div className="grid md:grid-cols-2 gap-0">
          {/* Image */}
          <div className="relative bg-gradient-to-br from-royal-50 via-white to-gold-50 p-8 flex items-center justify-center min-h-[300px]">
            {product.badge && (
              <div className="absolute top-4 right-4 bg-gradient-to-l from-gold-500 to-gold-400 text-royal-900 text-xs font-bold px-3 py-1.5 rounded-full">
                {product.badge}
              </div>
            )}
            {discount > 0 && (
              <div className="absolute top-4 left-12 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                خصم {discount}%
              </div>
            )}
            <div className="text-[120px] animate-float">{product.image}</div>
          </div>

          {/* Details */}
          <div className="p-8 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-royal-100 text-royal-700 font-bold px-3 py-1 rounded-full">
                  {languageLabel[product.language]}
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-full">
                  {product.cardCount} بطاقة
                </span>
              </div>
              <h2 className="text-2xl font-black text-royal-900 leading-relaxed">{product.name}</h2>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-gold-400 text-gold-400" />
                ))}
              </div>
              <span className="text-sm text-gray-500">4.9 (128 تقييم)</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 pb-4 border-b border-gray-100">
              <span className="text-4xl font-black text-royal-700">{product.price}</span>
              <span className="text-lg text-royal-600 font-medium">د.ج</span>
              {product.originalPrice && (
                <span className="text-lg text-gray-400 line-through">{product.originalPrice} د.ج</span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 leading-relaxed">{product.longDescription}</p>

            {/* Benefits */}
            <div className="space-y-2">
              <h4 className="font-bold text-royal-800 text-sm">كيف تفيدك كأستاذ:</h4>
              <div className="grid grid-cols-1 gap-2">
                {product.benefits.map((benefit, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-5 h-5 rounded-full bg-royal-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-royal-600" />
                    </div>
                    {benefit}
                  </div>
                ))}
              </div>
            </div>

            {/* Quantity & Add to Cart */}
            <div className="flex items-center gap-4 pt-4">
              <div className="flex items-center border-2 border-royal-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="p-2.5 hover:bg-royal-50 transition-colors"
                >
                  <Minus className="w-4 h-4 text-royal-600" />
                </button>
                <span className="w-12 text-center font-bold text-royal-800">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="p-2.5 hover:bg-royal-50 transition-colors"
                >
                  <Plus className="w-4 h-4 text-royal-600" />
                </button>
              </div>
              <button
                onClick={handleAdd}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${
                  added
                    ? 'bg-green-500 text-white'
                    : 'bg-gradient-to-l from-royal-700 to-royal-600 hover:from-royal-600 hover:to-royal-500 text-white shadow-lg shadow-royal-200 hover:shadow-royal-300'
                }`}
              >
                {added ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>تمت الإضافة!</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    <span>أضف إلى السلة</span>
                  </>
                )}
              </button>
            </div>

            {/* Guarantees */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {[
                { icon: '🚚', text: 'توصيل عبر Noest' },
                { icon: '💰', text: 'الدفع عند الاستلام' },
                { icon: '↩️', text: 'إرجاع مجاني' },
                { icon: '⭐', text: 'جودة مضمونة' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
