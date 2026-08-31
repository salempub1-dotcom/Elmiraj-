import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');

const replacements = [
  [
`    className="inline-flex items-center gap-1.5 rounded-full font-bold transition-colors
      min-h-[44px] px-3 py-2 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 active:bg-emerald-500/30
      sm:min-h-0 sm:px-0 sm:py-0 sm:bg-transparent sm:text-inherit sm:font-normal sm:gap-1 sm:hover:underline sm:hover:bg-transparent sm:active:bg-transparent"`,
`    className="inline-flex items-center gap-1.5 rounded-xl font-extrabold transition-all border border-emerald-400/60 shadow-sm shadow-black/10
      min-h-[44px] px-3.5 py-2 bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700
      sm:min-h-[36px] sm:px-3 sm:py-1.5 sm:text-sm print:min-h-0 print:border-0 print:bg-transparent print:text-black print:shadow-none print:p-0"`
  ],
  [
`    <span className="sm:hidden print:hidden text-[11px] font-extrabold bg-emerald-500 text-white px-2 py-0.5 rounded-full">اتصال</span>`,
`    <span className="print:hidden text-[11px] font-extrabold bg-white/20 text-white px-2 py-0.5 rounded-md">اتصال</span>`
  ],
  [
`    className={\`inline-flex items-center -my-1 py-1 hover:underline focus:underline \${className}\`}`,
`    className={\`inline-flex items-center rounded-lg border border-emerald-200 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300
      min-h-[40px] sm:min-h-[32px] px-2.5 py-1.5 sm:py-1 font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors print:min-h-0 print:border-0 print:bg-transparent print:text-black print:p-0 \${className}\`}`
  ],
  [
`          <div className="text-left flex-shrink-0">
            <p className="text-lg sm:text-xl font-extrabold text-white whitespace-nowrap">{order.total.toLocaleString()} دج</p>
            <p className="text-gray-300 text-xs mt-0.5 whitespace-nowrap">{order.date}</p>
          </div>`,
`          <div className="text-left flex-shrink-0 w-[108px] sm:w-[122px] space-y-1.5">
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
          </div>`
  ],
];

for (const [oldText, newText] of replacements) {
  const first = source.indexOf(oldText);
  if (first === -1) throw new Error(`Expected replacement source not found: ${oldText.slice(0, 80)}`);
  if (source.indexOf(oldText, first + oldText.length) !== -1) throw new Error(`Expected source to be unique: ${oldText.slice(0, 80)}`);
  source = source.replace(oldText, newText);
}

fs.writeFileSync(path, source);
console.log('Applied admin mobile call + price polish.');
