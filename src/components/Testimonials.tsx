import { Star } from 'lucide-react';

export function Testimonials() {
  const testimonials = [
    {
      name: 'أستاذة سارة',
      grade: 'أستاذة إنجليزية - الابتدائي - الجزائر العاصمة',
      text: 'أخيراً وسيلة تعليمية جزائرية بمستوى عالمي! تلاميذي يتفاعلون مع البطاقات بشكل رائع وأصبحت الحصص أكثر حيوية. التوصيل عبر Noest كان سريع جداً.',
      rating: 5,
      avatar: '👩‍🏫'
    },
    {
      name: 'أستاذ كريم',
      grade: 'أستاذ فرنسية - المتوسط - وهران',
      text: 'الفلاش كاردز وفّرت عليّ ساعات من التحضير. أستخدمها يومياً في حصص القواعد والمفردات. التلاميذ أصبحوا يطلبون الأنشطة بالبطاقات! الدفع عند الاستلام سهّل الأمر.',
      rating: 5,
      avatar: '👨‍🏫'
    },
    {
      name: 'أستاذة نورة',
      grade: 'أستاذة إنجليزية - السنة الثالثة - قسنطينة',
      text: 'بطاقات المحادثة غيّرت حصصي تماماً. التلاميذ الخجولون أصبحوا يشاركون بفضل أنشطة لعب الأدوار. محتوى متوافق 100% مع المنهاج الجزائري.',
      rating: 5,
      avatar: '👩‍🏫'
    },
    {
      name: 'أستاذ يوسف',
      grade: 'أستاذ فرنسية - الابتدائي - سطيف',
      text: 'اشتريت مجموعة الكتابة الفرنسية وأنا مبهور بالجودة. الطباعة ممتازة، الحجم مناسب للعرض أمام القسم. أنصح كل زملائي الأساتذة بها.',
      rating: 5,
      avatar: '👨‍🏫'
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-14">
          <span className="inline-block bg-royal-50 text-royal-600 text-sm font-bold px-4 py-1.5 rounded-full mb-4">
            آراء الأساتذة
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-royal-900 mb-4">
            ماذا يقول الأساتذة عن وسائلنا
          </h2>
          <p className="text-gray-500">
            أكثر من 2000 أستاذ عبر 48 ولاية يثقون بمنتجات المعراج 🇩🇿
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, i) => (
            <div
              key={i}
              className="bg-gradient-to-br from-royal-50 to-white rounded-3xl p-6 border border-royal-100 hover:shadow-lg hover:shadow-royal-100/30 transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.1}s`, animationFillMode: 'both' }}
            >
              <div className="flex items-center gap-1 mb-3">
                {[...Array(testimonial.rating)].map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-gold-400 text-gold-400" />
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">"{testimonial.text}"</p>
              <div className="flex items-center gap-3 pt-3 border-t border-royal-100">
                <span className="text-2xl">{testimonial.avatar}</span>
                <div>
                  <h4 className="font-bold text-sm text-royal-800">{testimonial.name}</h4>
                  <p className="text-xs text-gray-500">{testimonial.grade}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
