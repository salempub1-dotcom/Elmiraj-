import { ShoppingCart, Eye, Star } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';

interface ProductCardProps {
  product: Product;
  onViewDetails: (product: Product) => void;
  index?: number;
}

export function ProductCard({ product, onViewDetails, index = 0 }: ProductCardProps) {
  const { addToCart } = useCart();

  const languageLabel = {
    english: { text: 'إنجليزي', color: 'bg-blue-100 text-blue-700' },
    french: { text: 'فرنسي', color: 'bg-purple-100 text-purple-700' },
    both: { text: 'ثنائي اللغة', color: 'bg-amber-100 text-amber-700' }
  };

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
      <div className="relative h-52 bg-gradient-to-br from-royal-50 via-white to-gold-50 flex items-center justify-center overflow-hidden">
        <div className="text-7xl transform group-hover:scale-125 transition-transform duration-700 ease-out">
          {product.image}
        </div>
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-royal-900/0 group-hover:bg-royal-900/5 transition-all duration-300" />
        
        {/* Quick actions */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300">
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails(product); }}
            className="bg-white/90 backdrop-blur-sm hover:bg-white text-royal-700 p-2.5 rounded-xl shadow-lg transition-all hover:scale-110"
            title="عرض التفاصيل"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); addToCart(product); }}
            className="bg-royal-600 hover:bg-royal-700 text-white p-2.5 rounded-xl shadow-lg transition-all hover:scale-110"
            title="إضافة للسلة"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Tags */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
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
        <p className="text-xs text-gray-500 mb-4 leading-relaxed line-clamp-2">
          {product.description}
        </p>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 fill-gold-400 text-gold-400" />
          ))}
          <span className="text-xs text-gray-400 mr-1">(4.9)</span>
        </div>

        {/* Price & CTA */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-royal-700">{product.price}</span>
            <span className="text-sm text-royal-600">د.ج</span>
            {product.originalPrice && (
              <span className="text-sm text-gray-400 line-through">{product.originalPrice}</span>
            )}
          </div>
          <button
            onClick={() => addToCart(product)}
            className="bg-royal-600 hover:bg-royal-700 text-white p-3 rounded-xl transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg hover:shadow-royal-200"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
