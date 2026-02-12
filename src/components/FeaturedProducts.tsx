import { products } from '../data/products';
import { ProductCard } from './ProductCard';
import { Product } from '../types';
import { ArrowLeft } from 'lucide-react';

interface FeaturedProductsProps {
  onViewDetails: (product: Product) => void;
  onViewAll: () => void;
}

export function FeaturedProducts({ onViewDetails, onViewAll }: FeaturedProductsProps) {
  const featured = products.filter(p => p.badge).slice(0, 4);

  return (
    <section className="py-20 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-4">
          <div>
            <span className="inline-block bg-gold-100 text-gold-700 text-sm font-bold px-4 py-1.5 rounded-full mb-3">
              يختارها الأساتذة
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-royal-900">
              الأكثر طلباً من الأساتذة
            </h2>
          </div>
          <button
            onClick={onViewAll}
            className="group flex items-center gap-2 text-royal-600 hover:text-royal-700 font-bold transition-colors"
          >
            <span>عرض جميع الوسائل التعليمية</span>
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map((product, i) => (
            <ProductCard key={product.id} product={product} onViewDetails={onViewDetails} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
