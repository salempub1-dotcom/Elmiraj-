export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { container: 'h-10 gap-2', icon: 'w-8 h-8', text: 'text-lg', sub: 'text-[9px]' },
    md: { container: 'h-12 gap-3', icon: 'w-10 h-10', text: 'text-2xl', sub: 'text-[10px]' },
    lg: { container: 'h-16 gap-4', icon: 'w-14 h-14', text: 'text-4xl', sub: 'text-xs' }
  };
  const s = sizes[size];

  return (
    <div className={`flex items-center ${s.container}`}>
      <div className={`${s.icon} relative`}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Book base */}
          <path d="M15 75 L50 65 L85 75 L85 25 L50 15 L15 25 Z" fill="#0f6d38" opacity="0.9" />
          <path d="M50 15 L50 65" stroke="#a8e1bd" strokeWidth="1.5" />
          <path d="M15 25 L50 15 L85 25" fill="none" stroke="#e6b800" strokeWidth="2" />
          {/* Growth sprout */}
          <path d="M50 15 C50 15 50 5 50 5" stroke="#0f6d38" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M50 8 C45 5 42 8 44 12" stroke="#1a8a4a" strokeWidth="2" fill="#3aae6c" strokeLinecap="round" />
          <path d="M50 8 C55 5 58 8 56 12" stroke="#1a8a4a" strokeWidth="2" fill="#3aae6c" strokeLinecap="round" />
          <path d="M50 5 C48 1 52 1 50 5" fill="#e6b800" />
          {/* Stars */}
          <circle cx="30" cy="10" r="1.5" fill="#e6b800" opacity="0.8" />
          <circle cx="70" cy="8" r="1.5" fill="#e6b800" opacity="0.8" />
          <circle cx="20" cy="18" r="1" fill="#e6b800" opacity="0.6" />
          <circle cx="80" cy="16" r="1" fill="#e6b800" opacity="0.6" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className={`${s.text} font-black text-royal-700 leading-none`} style={{ fontFamily: "'Amiri', serif" }}>
          المِعْراج
        </span>
        <span className={`${s.sub} text-gold-600 font-bold tracking-wider`}>
          وسائل تعليمية للأساتذة
        </span>
      </div>
    </div>
  );
}
