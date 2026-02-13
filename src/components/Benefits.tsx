import { BookOpen, Brain, Globe, Sparkles, GraduationCap, Clock } from 'lucide-react';

export function Benefits() {
  const benefits = [
    {
      icon: BookOpen,
      title: 'تنويع أساليب التدريس',
      description: 'فلاش كاردز تمكّن الأستاذ من الخروج عن الطريقة التقليدية وتقديم الدروس بأساليب بصرية تفاعلية'
    },
    {
      icon: Brain,
      title: 'تعزيز مشاركة التلاميذ',
      description: 'بطاقات مصممة لتحفيز التلاميذ على المشاركة الفعّالة من خلال الألعاب والأنشطة الجماعية'
    },
    {
      icon: Globe,
      title: 'إنجليزية وفرنسية',
      description: 'وسائل متوفرة بالإنجليزية والفرنسية لتغطية احتياجات أساتذة اللغتين في جميع المراحل'
    },
    {
      icon: Clock,
      title: 'توفير وقت التحضير',
      description: 'بطاقات جاهزة للاستخدام الفوري في القسم — لا حاجة لساعات من التحضير والتصميم'
    },
    {
      icon: Sparkles,
      title: 'جودة طباعة احترافية',
      description: 'مطبوعة على ورق سميك مقوّى ومغلف يتحمل الاستخدام اليومي المتكرر في القسم'
    },
    {
      icon: GraduationCap,
      title: 'متوافقة مع المنهاج الجزائري',
      description: 'محتوى مصمم وفق المناهج والكفاءات المستهدفة في البرنامج الدراسي الجزائري'
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-royal-50 to-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-14">
          <span className="inline-block bg-gold-100 text-gold-700 text-sm font-bold px-4 py-1.5 rounded-full mb-4">
            لماذا المعراج؟
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-royal-900 mb-4">
            لماذا يختار الأساتذة وسائلنا؟
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            أدوات تعليمية مصممة من أساتذة لأساتذة — لأن نجاح الحصة يبدأ بوسائل احترافية
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, i) => (
            <div
              key={i}
              className="group relative bg-white rounded-3xl p-8 border border-gray-100 hover:border-royal-200 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-royal-100/30 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.1}s`, animationFillMode: 'both' }}
            >
              <div className="w-14 h-14 bg-gradient-to-br from-royal-100 to-royal-50 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-gradient-to-br group-hover:from-royal-600 group-hover:to-royal-500 transition-all duration-300">
                <benefit.icon className="w-7 h-7 text-royal-600 group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="text-lg font-bold text-royal-900 mb-2">{benefit.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
