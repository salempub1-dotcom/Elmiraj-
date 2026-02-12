import { ArrowLeft, Star, BookOpen, Users, Award } from 'lucide-react';

interface HeroProps {
  onNavigate: (view: string) => void;
}

export function Hero({ onNavigate }: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-bl from-royal-900 via-royal-800 to-royal-700" />
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 right-10 text-8xl animate-float">📚</div>
        <div className="absolute top-40 left-20 text-6xl animate-float delay-200">🎓</div>
        <div className="absolute bottom-20 right-1/3 text-7xl animate-float delay-300">✨</div>
        <div className="absolute top-20 left-1/3 text-5xl animate-float delay-100">🌟</div>
      </div>
      {/* Decorative shapes */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gold-400/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-royal-400/10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div className="space-y-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-gold-300 text-sm">
              <Star className="w-4 h-4 fill-gold-400 text-gold-400" />
              <span>وسائل تعليمية احترافية للأساتذة 🇩🇿</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight">
              أدوات تعليمية
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-gold-300 via-gold-400 to-gold-500">
                في يد الأستاذ
              </span>
            </h1>

            <p className="text-lg text-royal-100/80 leading-relaxed max-w-lg">
              فلاش كاردز احترافية باللغتين الإنجليزية والفرنسية، مصممة خصيصاً
              لأساتذة اللغات لتنشيط الحصص وتحقيق أهداف التعلم بطريقة تفاعلية وممتعة.
              <span className="block mt-2 text-gold-300/80 font-medium">💰 الدفع عند الاستلام • 🚚 توصيل لكل الولايات</span>
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => onNavigate('products')}
                className="group flex items-center gap-2 bg-gradient-to-l from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-royal-900 font-bold px-8 py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-gold-500/30 hover:shadow-gold-500/50 hover:-translate-y-0.5"
              >
                <span>تصفح الوسائل التعليمية</span>
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('categories');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-2 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white font-bold px-8 py-4 rounded-2xl border border-white/20 transition-all duration-300 hover:-translate-y-0.5"
              >
                <span>حسب الطور الدراسي</span>
              </button>
            </div>

            {/* 3 Phases Tags */}
            <div className="flex flex-wrap gap-3 pt-2">
              {[
                { icon: '🌱', label: 'التحضيري', color: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200' },
                { icon: '📘', label: 'الابتدائي', color: 'bg-blue-500/20 border-blue-400/30 text-blue-200' },
                { icon: '🎓', label: 'المتوسط', color: 'bg-purple-500/20 border-purple-400/30 text-purple-200' },
              ].map((phase, i) => (
                <span key={i} className={`inline-flex items-center gap-2 ${phase.color} border backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium`}>
                  <span>{phase.icon}</span>
                  {phase.label}
                </span>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-4">
              {[
                { icon: BookOpen, label: 'بطاقة تعليمية', value: '+1000' },
                { icon: Users, label: 'أستاذ يثق بنا', value: '+2000' },
                { icon: Award, label: 'تقييم إيجابي', value: '4.9' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <stat.icon className="w-6 h-6 text-gold-400 mx-auto mb-1" />
                  <div className="text-2xl font-black text-white">{stat.value}</div>
                  <div className="text-xs text-royal-200/60">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual Cards Display */}
          <div className="hidden lg:flex justify-center items-center relative">
            <div className="relative w-80 h-96">
              {/* Card Stack Effect */}
              <div className="absolute top-8 right-8 w-64 h-80 bg-gradient-to-br from-royal-500 to-royal-600 rounded-3xl shadow-2xl rotate-6 opacity-40" />
              <div className="absolute top-4 right-4 w-64 h-80 bg-gradient-to-br from-royal-400 to-royal-500 rounded-3xl shadow-2xl rotate-3 opacity-60" />
              <div className="relative w-64 h-80 bg-gradient-to-br from-white to-royal-50 rounded-3xl shadow-2xl p-6 flex flex-col items-center justify-center animate-float">
                <div className="text-7xl mb-4">🧑‍🏫</div>
                <div className="w-16 h-1 bg-gradient-to-l from-gold-400 to-gold-500 rounded-full mb-4" />
                <h3 className="text-xl font-bold text-royal-800 text-center mb-2">وسائل تعليمية</h3>
                <p className="text-sm text-royal-600 text-center">للأستاذ المبدع</p>
                <div className="mt-4 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-gold-400 text-gold-400" />
                  ))}
                </div>
                <div className="absolute -top-3 -right-3 bg-gold-500 text-royal-900 text-xs font-bold px-3 py-1 rounded-full">
                  للأساتذة
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wave bottom */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" className="w-full h-auto">
          <path fill="#ffffff" d="M0,80 C360,120 720,40 1080,80 C1260,100 1380,90 1440,80 L1440,120 L0,120 Z" />
        </svg>
      </div>
    </section>
  );
}
