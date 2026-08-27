import fs from 'node:fs';

const appPath = 'src/App.tsx';
const verifyPath = 'scripts/verify-delivery-integration.mjs';

let app = fs.readFileSync(appPath, 'utf8');
let verify = fs.readFileSync(verifyPath, 'utf8');

function replaceExact(source, before, after, label) {
  if (!source.includes(before)) {
    if (source.includes(after)) return source;
    throw new Error(`Missing expected block: ${label}`);
  }
  return source.replace(before, after);
}

app = replaceExact(
  app,
  `  const rowTone = rowIndex % 2 === 0\n    ? 'bg-[#E5EEF9] border-blue-200 border-r-4 border-r-[#183C6B] dark:bg-[#0B1833] dark:border-blue-950 dark:border-r-blue-500'\n    : 'bg-[#F4F8FD] border-sky-200 border-r-4 border-r-[#79A5D2] dark:bg-[#132A46] dark:border-sky-950 dark:border-r-sky-400';`,
  `  const rowTone = rowIndex % 2 === 0\n    ? 'bg-[#102A52] border-[#183C6B] dark:bg-[#102A52] dark:border-[#183C6B]'\n    : 'bg-[#171A1F] border-[#2A3038] dark:bg-[#171A1F] dark:border-[#2A3038]';`,
  'alternating card colors',
);

app = replaceExact(
  app,
  `<span className="font-mono text-[#102A52] dark:text-blue-200 font-extrabold text-sm">{order.tracking}</span>`,
  `<span className="font-mono text-white font-extrabold text-sm">{order.tracking}</span>`,
  'tracking color',
);

app = replaceExact(
  app,
  `<span className="bg-white/70 dark:bg-white/10 text-gray-500 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full font-bold">🚚 لم يرسل</span>`,
  `<span className="bg-white/10 text-gray-200 text-xs px-2 py-0.5 rounded-full font-bold">🚚 لم يرسل</span>`,
  'unsent badge',
);

app = app.replace(`              <span className="text-[11px] text-gray-400 dark:text-gray-400 font-bold">{expanded ? '▲ إخفاء التفاصيل' : '▼ اضغط لعرض التفاصيل'}</span>\n`, '');

app = replaceExact(
  app,
  `<div className="space-y-0.5 text-sm text-gray-700 dark:text-gray-200">`,
  `<div className="space-y-0.5 text-sm text-gray-100">`,
  'compact customer text',
);

app = replaceExact(
  app,
  `<p className="text-lg sm:text-xl font-extrabold text-blue-800 dark:text-blue-200 whitespace-nowrap">{order.total.toLocaleString()} دج</p>\n            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 whitespace-nowrap">{order.date}</p>`,
  `<p className="text-lg sm:text-xl font-extrabold text-white whitespace-nowrap">{order.total.toLocaleString()} دج</p>\n            <p className="text-gray-300 text-xs mt-0.5 whitespace-nowrap">{order.date}</p>`,
  'total and date colors',
);

app = replaceExact(
  app,
  `<div className="mt-2 pt-2 border-t border-blue-200/60 dark:border-white/10 space-y-0.5">`,
  `<div className="mt-2 pt-2 border-t border-white/10 space-y-0.5">`,
  'items separator',
);

app = replaceExact(
  app,
  `<span className="min-w-0 truncate text-gray-700 dark:text-gray-200">{item.name} × {item.quantity}</span>\n              <span className="font-extrabold text-gray-800 dark:text-gray-100 whitespace-nowrap">{(item.price * item.quantity).toLocaleString()} دج</span>`,
  `<span className="min-w-0 truncate text-gray-100">{item.name} × {item.quantity}</span>\n              <span className="font-extrabold text-white whitespace-nowrap">{(item.price * item.quantity).toLocaleString()} دج</span>`,
  'item colors',
);

app = replaceExact(
  app,
  `className={\`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all \${normalizeOrderStatus(order.status) === status ? 'bg-[#183C6B] text-white shadow-sm' : 'bg-white/75 dark:bg-white/10 text-gray-600 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900/40'}\`}`,
  `className={\`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all \${normalizeOrderStatus(order.status) === status ? 'bg-white text-[#102A52] shadow-sm' : 'bg-white/10 text-gray-100 hover:bg-white/20'}\`}`,
  'status button contrast',
);

app = replaceExact(
  app,
  `<div className="mt-3 pt-2 border-t border-blue-200/60 dark:border-white/10 flex flex-wrap items-center gap-2">`,
  `<div className="mt-3 pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">`,
  'action separator',
);

const detailsButton = `          <button\n            type="button"\n            onClick={() => setExpanded(v => !v)}\n            className={\`px-3 py-2 rounded-xl text-xs font-bold border transition-all \${expanded ? 'bg-blue-100 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200' : 'bg-white/70 dark:bg-white/10 border-blue-200/70 dark:border-white/10 text-gray-600 dark:text-gray-200'} \${canSend ? '' : 'mr-auto'}\`}\n          >\n            {expanded ? '▲ إخفاء التفاصيل' : '▼ باقي التفاصيل'}\n          </button>\n`;
if (app.includes(detailsButton)) app = app.replace(detailsButton, '');

app = replaceExact(
  app,
  `<div className="px-3 sm:px-4 pb-4 pt-3 border-t border-blue-200/70 dark:border-white/10 bg-white/35 dark:bg-black/10 rounded-b-xl">`,
  `<div className="px-3 sm:px-4 pb-4 pt-3 border-t border-white/10 bg-white/95 dark:bg-[#0E131A] rounded-b-xl">`,
  'expanded panel background',
);

verify = verify.replace(
  `assert.match(appSource, /rowIndex % 2 === 0/);\nassert.match(appSource, /اضغط لعرض التفاصيل/);\nassert.ok(appSource.includes('إرسال إلى \${providerLabel}'));`,
  `assert.match(appSource, /rowIndex % 2 === 0/);\nassert.ok(appSource.includes("bg-[#102A52] border-[#183C6B]"));\nassert.ok(appSource.includes("bg-[#171A1F] border-[#2A3038]"));\nassert.doesNotMatch(appSource, /border-r-4/);\nassert.doesNotMatch(appSource, /اضغط لعرض التفاصيل/);\nassert.doesNotMatch(appSource, /باقي التفاصيل/);\nassert.ok(appSource.includes('إرسال إلى \${providerLabel}'));`,
);

fs.writeFileSync(appPath, app);
fs.writeFileSync(verifyPath, verify);
console.log('✅ Applied navy/charcoal card alternation with click-only expansion.');
