import { grades } from '../data/products';

interface CategoriesProps {
  onSelectGrade: (grade: string) => void;
}

export function Categories({ onSelectGrade }: CategoriesProps) {
  return (
    <section id="categories" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-14">
          <span className="inline-block bg-royal-50 text-royal-600 text-sm font-bold px-4 py-1.5 rounded-full mb-4">
            حسب المرحلة الدراسية
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-royal-900 mb-4">
            اختر المرحلة التي تدرّسها
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            وسائل تعليمية مصممة لكل مرحلة دراسية — اختر المرحلة واكتشف الأدوات التي تناسب حصصك
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {grades.map((grade, i) => (
            <button
              key={grade.id}
              onClick={() => onSelectGrade(grade.id)}
              className={`group relative overflow-hidden rounded-3xl p-8 text-right transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-royal-200/50 animate-fade-in-up bg-gradient-to-br from-white to-royal-50 border-2 border-royal-100 hover:border-royal-300`}
              style={{ animationDelay: `${i * 0.1}s`, animationFillMode: 'both' }}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-l from-royal-500 to-gold-500 transform origin-right scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
              
              <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                {grade.icon}
              </div>
              <h3 className="text-xl font-bold text-royal-800 mb-2">{grade.name}</h3>
              <p className="text-sm text-gray-500 mb-3">{grade.description}</p>
              <div className="inline-flex items-center gap-1 text-xs bg-royal-100 text-royal-700 px-3 py-1 rounded-full font-medium">
                🎂 {grade.ageRange}
              </div>
              
              <div className="mt-4 flex items-center gap-1 text-royal-600 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                <span>عرض المنتجات</span>
                <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
