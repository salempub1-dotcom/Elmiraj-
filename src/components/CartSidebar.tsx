import { X, Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getDeliveryFee } from '../services/noest';

interface CartSidebarProps {
  onCheckout: () => void;
}

export function CartSidebar({ onCheckout }: CartSidebarProps) {
  const { items, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, totalPrice, totalItems, clearCart } = useCart();

  // Default shipping cost (Alger home delivery = 500 DA) - exact cost calculated at checkout
  const estimatedShipping = totalPrice >= 5000 ? 0 : getDeliveryFee(16, true); // 500 DA for Algiers

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
      <div className="absolute top-0 left-0 h-full w-full max-w-md bg-white shadow-2xl animate-slide-in-right flex flex-col" style={{ direction: 'rtl' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-royal-100 p-2 rounded-xl">
              <ShoppingBag className="w-5 h-5 text-royal-700" />
            </div>
            <div>
              <h3 className="font-bold text-royal-900">سلة التسوق</h3>
              <span className="text-xs text-gray-500">{totalItems} منتج</span>
            </div>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="text-6xl">🛒</div>
              <h4 className="text-lg font-bold text-gray-400">السلة فارغة</h4>
              <p className="text-sm text-gray-400">ابدأ بإضافة المنتجات التعليمية لسلتك</p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="flex items-center gap-2 bg-royal-600 hover:bg-royal-700 text-white px-6 py-3 rounded-xl font-medium text-sm transition-all"
              >
                <span>تصفح المنتجات</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            items.map(item => (
              <div key={item.product.id} className="flex gap-4 bg-gray-50 rounded-2xl p-4 transition-all hover:bg-royal-50">
                <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-3xl flex-shrink-0 shadow-sm">
                  {item.product.image}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-royal-900 line-clamp-1">{item.product.name}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{item.product.cardCount} بطاقة</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1.5 hover:bg-gray-50 transition-colors"
                      >
                        <Minus className="w-3 h-3 text-gray-500" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-royal-800">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1.5 hover:bg-gray-50 transition-colors"
                      >
                        <Plus className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                    <span className="font-bold text-royal-700 text-sm">{item.product.price * item.quantity} د.ج</span>
                  </div>
                </div>
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="self-start p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 p-5 space-y-4 bg-white">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">المجموع الفرعي</span>
              <span className="font-bold text-royal-800">{totalPrice} د.ج</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">التوصيل (تقديري)</span>
              <span className="font-bold text-green-600">{estimatedShipping === 0 ? 'مجاني ✨' : `ابتداءً من ${estimatedShipping} د.ج`}</span>
            </div>
            {estimatedShipping > 0 && totalPrice < 5000 && (
              <div className="bg-gold-50 border border-gold-200 rounded-xl p-3 text-xs text-gold-800 text-center">
                🎁 أضف {5000 - totalPrice} د.ج للحصول على توصيل مجاني!
              </div>
            )}
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
              <span className="font-bold text-royal-900">الإجمالي</span>
              <span className="text-2xl font-black text-royal-700">
                {totalPrice + estimatedShipping} د.ج
              </span>
            </div>
            <div className="bg-royal-50 rounded-xl p-3 text-xs text-royal-700 text-center font-medium">
              💰 الدفع عند الاستلام &bull; 🚚 التوصيل عبر Noest
            </div>
            <p className="text-[10px] text-gray-400 text-center">
              * تكلفة التوصيل النهائية تُحسب حسب الولاية عند إتمام الطلب
            </p>
            <button
              onClick={() => { setIsCartOpen(false); onCheckout(); }}
              className="w-full bg-gradient-to-l from-royal-700 to-royal-600 hover:from-royal-600 hover:to-royal-500 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-royal-200 hover:shadow-royal-300"
            >
              إتمام الطلب
            </button>
            <button
              onClick={clearCart}
              className="w-full text-sm text-gray-400 hover:text-red-500 transition-colors py-1"
            >
              تفريغ السلة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
