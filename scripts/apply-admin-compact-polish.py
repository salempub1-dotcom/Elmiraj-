from pathlib import Path

p = Path('src/App.tsx')
s = p.read_text()

replacements = [
    (
'''    className="inline-flex items-center gap-1.5 rounded-xl font-extrabold transition-all border border-emerald-400/60 shadow-sm shadow-black/10
      min-h-[44px] px-3.5 py-2 bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700
      sm:min-h-[36px] sm:px-3 sm:py-1.5 sm:text-sm print:min-h-0 print:border-0 print:bg-transparent print:text-black print:shadow-none print:p-0"''',
'''    className="inline-flex items-center gap-1 rounded-lg font-extrabold transition-all border border-emerald-400/50 shadow-sm shadow-black/10
      min-h-[40px] px-2.5 py-1.5 bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700 text-[13px]
      sm:min-h-[32px] sm:px-2.5 sm:py-1 sm:text-xs print:min-h-0 print:border-0 print:bg-transparent print:text-black print:shadow-none print:p-0"'''
    ),
    (
'''    <span className="print:hidden text-[11px] font-extrabold bg-white/20 text-white px-2 py-0.5 rounded-md">اتصال</span>''',
'''    <span className="print:hidden text-[10px] font-extrabold bg-white/20 text-white px-1.5 py-0.5 rounded">اتصال</span>'''
    ),
    (
'''    className={`inline-flex items-center rounded-lg border border-emerald-200 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300
      min-h-[40px] sm:min-h-[32px] px-2.5 py-1.5 sm:py-1 font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors print:min-h-0 print:border-0 print:bg-transparent print:text-black print:p-0 ${className}`}''',
'''    className={`inline-flex items-center rounded-md border border-emerald-200 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300
      min-h-[36px] sm:min-h-[30px] px-2 py-1 sm:py-0.5 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors print:min-h-0 print:border-0 print:bg-transparent print:text-black print:p-0 ${className}`}'''
    ),
    (
'''          <div className="text-left flex-shrink-0 w-[108px] sm:w-[122px] space-y-1.5">
            <div className="rounded-xl bg-emerald-500 border border-emerald-400/60 text-white px-2.5 sm:px-3 py-2 shadow-sm shadow-black/10 text-center">
              <p className="text-[10px] font-bold text-emerald-50 leading-none mb-1">الإجمالي</p>
              <p className="text-base sm:text-lg font-extrabold whitespace-nowrap leading-none">{order.total.toLocaleString()} دج</p>
            </div>
            {order.shipping > 0 && (
              <div className="rounded-xl bg-amber-300 border border-amber-200 text-amber-950 px-2.5 sm:px-3 py-1.5 shadow-sm text-center">
                <p className="text-[10px] font-bold leading-none mb-1">التوصيل</p>
                <p className="text-sm font-extrabold whitespace-nowrap leading-none">{order.shipping.toLocaleString()} دج</p>
              </div>
            )}
            <p className="text-gray-300 text-[11px] text-center whitespace-nowrap">{order.date}</p>
          </div>''',
'''          <div className="text-left flex-shrink-0 w-[96px] sm:w-[106px] space-y-1">
            <div className="rounded-lg bg-emerald-500 border border-emerald-400/50 text-white px-2 py-1.5 shadow-sm shadow-black/10 text-center">
              <p className="text-[9px] font-bold text-emerald-50 leading-none mb-0.5">الإجمالي</p>
              <p className="text-[14px] sm:text-base font-extrabold whitespace-nowrap leading-none">{order.total.toLocaleString()} دج</p>
            </div>
            {order.shipping > 0 && (
              <div className="rounded-lg bg-amber-300 border border-amber-200 text-amber-950 px-2 py-1 shadow-sm text-center">
                <p className="text-[9px] font-bold leading-none mb-0.5">التوصيل</p>
                <p className="text-[12px] sm:text-sm font-extrabold whitespace-nowrap leading-none">{order.shipping.toLocaleString()} دج</p>
              </div>
            )}
            <p className="text-gray-300 text-[10px] text-center whitespace-nowrap">{order.date}</p>
          </div>'''
    ),
    (
'''            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-gray-100">{item.name} × {item.quantity}</span>
              <span className="font-extrabold text-white whitespace-nowrap">{(item.price * item.quantity).toLocaleString()} دج</span>
            </div>''',
'''            <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 max-w-[72%] truncate rounded-md border border-red-400/70 bg-red-500/15 px-2 py-1 text-red-50 font-bold">{item.name} × {item.quantity}</span>
              <span className="font-extrabold text-white whitespace-nowrap">{(item.price * item.quantity).toLocaleString()} دج</span>
            </div>'''
    ),
]

for old, new in replacements:
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one match, got {count}: {old[:120]!r}')
    s = s.replace(old, new, 1)

p.write_text(s)
print('Applied compact admin order polish successfully')
