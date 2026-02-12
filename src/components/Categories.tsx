import React, { useState } from 'react';

interface CategoriesProps {
  onSelectGrade: (gradeId: string, year?: number) => void;
}

const Categories: React.FC<CategoriesProps> = ({ onSelectGrade }) => {
  const [activePhase, setActivePhase] = useState<string | null>(null);

  const phases = [
    {
      id: 'preparatory',
      name: 'التحضيري',
      icon: '🌱',
      description: 'بطاقات تعليمية للقسم التحضيري',
      gradient: 'from-emerald-500 to-green-600',
      lightBg: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      textColor: 'text-emerald-700',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700',
      ringColor: 'ring-emerald-400',
      hoverBorder: '#059669',
      years: [
        { year: 0, label: 'القسم التحضيري', subtitle: '5-6 سنوات', icon: '🌱' }
      ],
      productCount: 4
    },
    {
      id: 'elementary',
      name: 'الابتدائي',
      icon: '📘',
      description: 'وسائل تعليمية من السنة الأولى إلى الخامسة',
      gradient: 'from-blue-500 to-indigo-600',
      lightBg: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      badgeColor: 'bg-blue-100 text-blue-700',
      btnColor: 'bg-blue-600 hover:bg-blue-700',
      ringColor: 'ring-blue-400',
      hoverBorder: '#2563eb',
      years: [
        { year: 1, label: 'السنة 1', subtitle: '6-7 سنوات', icon: '1' },
        { year: 2, label: 'السنة 2', subtitle: '7-8 سنوات', icon: '2' },
        { year: 3, label: 'السنة 3', subtitle: '8-9 سنوات', icon: '3' },
        { year: 4, label: 'السنة 4', subtitle: '9-10 سنوات', icon: '4' },
        { year: 5, label: 'السنة 5', subtitle: '10-11 سنوات', icon: '5' },
      ],
      productCount: 7
    },
    {
      id: 'middle',
      name: 'المتوسط',
      icon: '🎓',
      description: 'وسائل تعليمية من السنة الأولى إلى الرابعة',
      gradient: 'from-purple-500 to-violet-600',
      lightBg: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700',
      badgeColor: 'bg-purple-100 text-purple-700',
      btnColor: 'bg-purple-600 hover:bg-purple-700',
      ringColor: 'ring-purple-400',
      hoverBorder: '#7c3aed',
      years: [
        { year: 1, label: 'السنة 1', subtitle: '11-12 سنة', icon: '1' },
        { year: 2, label: 'السنة 2', subtitle: '12-13 سنة', icon: '2' },
        { year: 3, label: 'السنة 3', subtitle: '13-14 سنة', icon: '3' },
        { year: 4, label: 'السنة 4', subtitle: '14-15 سنة', icon: '4' },
      ],
      productCount: 5
    }
  ];

  const handlePhaseClick = (phaseId: string) => {
    setActivePhase(activePhase === phaseId ? null : phaseId);
  };

  return (
    <section id="categories" className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-[#0f6d38]/10 text-[#0f6d38] px-5 py-2 rounded-full text-sm font-bold mb-4">
            <span>📚</span>
            <span>اختر المرحلة التي تُدرّسها</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            الأطوار <span className="text-[#0f6d38]">التعليمية</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            اضغط على الطور لاستعراض السنوات والوسائل التعليمية المتوفرة
          </p>
        </div>

        {/* Phases */}
        <div className="max-w-5xl mx-auto space-y-6">
          {phases.map((phase) => {
            const isActive = activePhase === phase.id;

            return (
              <div
                key={phase.id}
                className={`rounded-3xl overflow-hidden transition-all duration-500 ease-in-out ${
                  isActive
                    ? `shadow-2xl ring-2 ring-offset-2 ${phase.ringColor}`
                    : 'shadow-lg hover:shadow-xl'
                }`}
              >
                {/* Phase Header - Clickable */}
                <button
                  onClick={() => handlePhaseClick(phase.id)}
                  className={`w-full bg-gradient-to-l ${phase.gradient} p-8 md:p-10 flex items-center justify-between transition-all duration-300 group cursor-pointer`}
                >
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-5xl md:text-6xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                      {phase.icon}
                    </div>
                    <div className="text-right">
                      <h3 className="text-3xl md:text-4xl font-bold text-white mb-1">
                        {phase.name}
                      </h3>
                      <p className="text-white/80 text-base md:text-lg">
                        {phase.description}
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="bg-white/20 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full">
                          {phase.years.length} {phase.years.length === 1 ? 'مستوى' : 'مستويات'}
                        </span>
                        <span className="bg-white/20 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full">
                          {phase.productCount} منتج
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className={`w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-500 ${
                    isActive ? 'rotate-180 bg-white/30' : 'group-hover:bg-white/30'
                  }`}>
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Years Panel - Expandable */}
                <div
                  className={`transition-all duration-500 ease-in-out overflow-hidden ${
                    isActive ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className={`p-6 md:p-8 ${phase.lightBg} border-t ${phase.borderColor}`}>
                    {/* Years Grid */}
                    <div className={`grid gap-4 ${
                      phase.years.length === 1
                        ? 'grid-cols-1 max-w-sm mx-auto'
                        : phase.years.length <= 4
                          ? 'grid-cols-2 md:grid-cols-4'
                          : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5'
                    }`}>
                      {phase.years.map((yearItem) => (
                        <button
                          key={yearItem.year}
                          onClick={() => onSelectGrade(phase.id, yearItem.year)}
                          className="bg-white rounded-2xl p-5 shadow-md hover:shadow-xl transition-all duration-300 group/year cursor-pointer border-2 border-transparent hover:scale-105 flex flex-col items-center text-center"
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = phase.hoverBorder;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                          }}
                        >
                          {/* Year Number */}
                          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${phase.gradient} text-white flex items-center justify-center text-2xl font-bold mb-3 group-hover/year:scale-110 transition-transform duration-300 shadow-md`}>
                            {yearItem.icon}
                          </div>

                          {/* Year Label */}
                          <h4 className={`font-bold text-lg mb-1 ${phase.textColor}`}>
                            {yearItem.label}
                          </h4>

                          {/* Age */}
                          <span className="text-gray-400 text-sm mb-3">
                            {yearItem.subtitle}
                          </span>

                          {/* View Arrow */}
                          <div className={`${phase.textColor} opacity-0 group-hover/year:opacity-100 transition-opacity duration-300 flex items-center gap-1 text-sm font-medium`}>
                            <span>عرض المنتجات</span>
                            <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* View All Button */}
                    <div className="text-center mt-6">
                      <button
                        onClick={() => onSelectGrade(phase.id)}
                        className={`${phase.btnColor} text-white px-8 py-3 rounded-xl font-bold text-lg transition-all duration-300 hover:shadow-lg hover:-translate-y-1 inline-flex items-center gap-2`}
                      >
                        <span>عرض كل وسائل {phase.name}</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded-lg text-sm">{phase.productCount}</span>
                        <svg className="w-5 h-5 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { icon: '🎴', label: 'فلاش كارد', value: '+500' },
            { icon: '🧑‍🏫', label: 'أستاذ يستخدمها', value: '+200' },
            { icon: '📦', label: 'طلب مُنجز', value: '+1000' },
            { icon: '⭐', label: 'تقييم إيجابي', value: '4.9/5' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 text-center shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-[#0f6d38]">{stat.value}</div>
              <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Categories;
