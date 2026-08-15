// نفس صورة الاحتياط المستخدمة في بقية المشروع لأي منتج بلا صورة (App.tsx) — للاتساق فقط.
const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop&auto=format';

const safeImg = (images?: string[] | null): string => (images && images.length > 0 ? images[0] : PLACEHOLDER_IMAGE);

// نوع محلي مطابق بنيويًا لواجهة Product الحقيقية في App.tsx (بدون استيرادها لتفادي أي اقتران
// غير ضروري) — أي بيانات منتج حقيقية من المشروع تُطابق هذا الشكل تلقائيًا.
export interface FeaturedProduct {
  id: number;
  name: string;
  price: number;
  images: string[];
  stock: number;
  sales: number;
  badge?: string;
}

interface TopProductsSectionProps {
  products: FeaturedProduct[];
  onAddToCart: (product: FeaturedProduct) => void;
  onBuyNow: (product: FeaturedProduct) => void;
  onViewProduct: (id: number) => void;
  onViewAll: () => void;
}

function FeaturedProductCard({
  product,
  onAddToCart,
  onBuyNow,
  onViewProduct,
}: {
  product: FeaturedProduct;
  onAddToCart: (product: FeaturedProduct) => void;
  onBuyNow: (product: FeaturedProduct) => void;
  onViewProduct: (id: number) => void;
}) {
  return (
    <div className="snap-start shrink-0 w-[85%] sm:w-[46%] lg:w-auto lg:shrink bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden group">
      <div className="relative h-36 sm:h-44 overflow-hidden cursor-pointer bg-gray-50" onClick={() => onViewProduct(product.id)}>
        <img
          src={safeImg(product.images)}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />
        {product.badge && (
          <span className="absolute top-2 right-2 bg-amber-500 text-white text-[11px] px-2 py-1 rounded-full font-bold shadow-sm">
            {product.badge}
          </span>
        )}
      </div>
      <div className="p-3.5 sm:p-4">
        <h3
          className="font-bold text-gray-800 text-sm sm:text-base leading-tight cursor-pointer hover:text-[#102A52] truncate"
          onClick={() => onViewProduct(product.id)}
        >
          {product.name}
        </h3>
        <p className="text-[#102A52] font-extrabold text-base sm:text-lg mt-1.5 mb-3">{product.price.toLocaleString()} دج</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            className="flex-1 bg-[#102A52] hover:bg-[#0B1833] text-white py-2 rounded-lg font-bold text-xs sm:text-sm transition-all"
          >
            🛒 أضف للعربة
          </button>
          <button
            type="button"
            onClick={() => onBuyNow(product)}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-bold text-xs sm:text-sm transition-all"
          >
            ⚡ اشتري الآن
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * قسم "الأكثر طلبًا لدى الأساتذة" — يعرض أفضل المنتجات مبيعًا (بيانات حقيقية من state
 * المنتجات الفعلي في المشروع، بدون أي بيانات وهمية). على الموبايل: Carousel أفقي بـ
 * CSS scroll-snap (بدون أي مكتبة). على الديسكتوب: Grid عادي.
 */
export default function TopProductsSection({ products, onAddToCart, onBuyNow, onViewProduct, onViewAll }: TopProductsSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className="bg-gray-50 py-10 sm:py-14 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6 sm:mb-9">
          <h2 className="text-xl sm:text-3xl font-extrabold text-[#0B1833]">الأكثر طلبًا لدى الأساتذة</h2>
          <span aria-hidden="true" className="block w-12 h-1 rounded-full bg-amber-500 mx-auto mt-3" />
        </div>

        <div className="miraj-scroll-x flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-4 px-4 pb-2 lg:mx-0 lg:px-0 lg:pb-0 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible">
          {products.map(product => (
            <FeaturedProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
              onBuyNow={onBuyNow}
              onViewProduct={onViewProduct}
            />
          ))}
        </div>

        <div className="text-center mt-8 sm:mt-10">
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-2 border-2 border-[#102A52] text-[#102A52] hover:bg-[#102A52] hover:text-white font-bold px-6 py-3 rounded-xl transition-all duration-200"
          >
            <span>عرض جميع المنتجات</span>
            <span aria-hidden="true">←</span>
          </button>
        </div>
      </div>
    </section>
  );
}
