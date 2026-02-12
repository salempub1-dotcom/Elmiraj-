import { ShoppingCart, Eye, Star, Zap } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { grades } from '../data/products';

interface ProductCardProps {
  product: Product;
  onViewDetails: (product: Product) => void;
  onBuyNow?: (product: Product) => void;
  index?: number;
}

export function ProductCard({ product, onViewDetails, onBuyNow, index = 0 }: ProductCardProps) {
  const { addToCart } = useCart();

  const languageLabel = {
    english: { text: 'إنجليزي', color: 'bg-blue-100 text-blue-700' },
    french: { text: 'فرنسي', color: 'bg-purple-100 text-purple-700' },
  };

  const gradeLabel: Record<string, { text: string; color: string }> = {
    preparatory: { text: 'التحضيري', color: 'bg-emerald-50 text-emerald-700' },
    elementary: { text: 'الابتدائي', color: 'bg-blue-50 text-blue-700' },
    middle: { text: 'المتوسط', color: 'bg-purple-50 text-purple-700' },
  };

  const gradeInfo = gradeLabel[product.grade] || { text: '', color: '' };
  const yearInfo = product.year ? grades.find(g => g.id === product.grade)?.years.find(y => y.year === product.year) : null;

  const lang = languageLabel[product.language];
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div
      className="group relative bg-white rounded-3xl border border-gray-100 overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-royal-100/50 hover:border-royal-200 animate-fade-in-up"
      style={{ animationDelay: `${index * 0.08}s`, animationFillMode: 'both' }}
    >
      {/* Badge */}
      {product.badge && (
        <div className="absolute top-4 right-4 z-10 bg-gradient-to-l from-gold-500 to-gold-400 text-royal-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
          {product.badge}
        </div>
      )}

      {/* Discount Badge */}
      {discount > 0 && (
        <div className="absolute top-4 left-4 z-10 bg-red-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-full">
          -{discount}%
        </div>
      )}

      {/* Image Area */}
      <div className="relative h-52 bg-gradient-to-br from-royal-50 via-white to-gold-50 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => onViewDetails(product)}>
        <div className="text-7xl transform group-hover:scale-125 transition-transform duration-700 ease-out">
          {product.image}
        </div>
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-royal-900/0 group-hover:bg-royal-900/5 transition-all duration-300" />
        
        {/* Quick view button */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300">
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails(product); }}
            className="bg-white/90 backdrop-blur-sm hover:bg-white text-royal-700 p-2.5 rounded-xl shadow-lg transition-all hover:scale-110"
            title="عرض التفاصيل"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Tags */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${gradeInfo.color}`}>
            {gradeInfo.text}{yearInfo ? ` • ${yearInfo.label}` : ''}
          </span>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${lang.color}`}>
            {lang.text}
          </span>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-royal-50 text-royal-600">
            {product.cardCount} بطاقة
          </span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-royal-900 mb-2 leading-relaxed line-clamp-2 group-hover:text-royal-700 transition-colors">
          {product.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">
          {product.description}
        </p>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 fill-gold-400 text-gold-400" />
          ))}
          <span className="text-xs text-gray-400 mr-1">(4.9)</span>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-black text-royal-700">{product.price}</span>
          <span className="text-sm text-royal-600">د.ج</span>
          {product.originalPrice && (
            <span className="text-sm text-gray-400 line-through">{product.originalPrice}</span>
          )}
        </div>

        {/* Two Action Buttons - Stacked on mobile, side by side on desktop */}
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* Add to Cart Button */}
          <button
            onClick={() => addToCart(product)}
            className="flex-1 flex items-center justify-center gap-2 bg-royal-600 hover:bg-royal-700 text-white py-3.5 sm:py-3 rounded-xl transition-all duration-300 hover:scale-[1.02] shadow-md hover:shadow-lg hover:shadow-royal-200 text-base sm:text-sm font-bold"
          >
            <ShoppingCart className="w-5 h-5 sm:w-4 sm:h-4" />
            <span>أضف للسلة</span>
          </button>

          {/* Buy Now Button */}
          <button
            onClick={() => onBuyNow?.(product)}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-l from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-royal-900 py-3.5 sm:py-3 px-4 rounded-xl transition-all duration-300 hover:scale-[1.02] shadow-md hover:shadow-lg hover:shadow-gold-200 text-base sm:text-sm font-bold"
            title="شراء مباشر"
          >
            <Zap className="w-5 h-5 sm:w-4 sm:h-4" />
            <span>اشتري الآن</span>
          </button>
        </div>
      </div>
    </div>
  );
}
