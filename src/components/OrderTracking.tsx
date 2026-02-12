import { useState } from 'react';
import {
  Search, Package, Truck, CheckCircle, Clock, MapPin,
  ArrowRight, AlertCircle, Loader2, User, Phone
} from 'lucide-react';
import {
  trackOrder, eventToArabic, getOverallStatus, getWilayaName,
  getEstimatedDays, type NoestTrackingResult
} from '../services/noest';

interface OrderTrackingProps {
  onBack: () => void;
}

export function OrderTracking({ onBack }: OrderTrackingProps) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [result, setResult] = useState<NoestTrackingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleTrack = async () => {
    const trimmed = trackingNumber.trim();
    if (!trimmed) {
      setError('الرجاء إدخال رقم التتبع');
      return;
    }
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const data = await trackOrder(trimmed);
      if (data) {
        setResult(data);
      } else {
        setError('لم يتم العثور على الطلب. تأكد من رقم التتبع وحاول مرة أخرى.');
        setResult(null);
      }
    } catch {
      setError('حدث خطأ أثناء البحث. حاول مرة أخرى.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ar-DZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_transit': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'picked_up': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'confirmed': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'returned': return 'bg-red-100 text-red-800 border-red-200';
      case 'suspended': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getActivityBadgeColor = (badgeClass: string) => {
    if (badgeClass.includes('success')) return 'bg-green-100 text-green-600';
    if (badgeClass.includes('primary')) return 'bg-blue-100 text-blue-600';
    if (badgeClass.includes('warning')) return 'bg-amber-100 text-amber-600';
    if (badgeClass.includes('danger')) return 'bg-red-100 text-red-600';
    if (badgeClass.includes('info')) return 'bg-cyan-100 text-cyan-600';
    return 'bg-gray-100 text-gray-600';
  };

  const getActivityIcon = (eventKey?: string) => {
    if (!eventKey) return <Clock className="w-4 h-4" />;
    if (['livre', 'livred'].includes(eventKey)) return <CheckCircle className="w-4 h-4" />;
    if (['fdr_activated', 'validation_reception'].includes(eventKey)) return <Truck className="w-4 h-4" />;
    if (eventKey.includes('return') || eventKey.includes('retour')) return <ArrowRight className="w-4 h-4" />;
    if (['validation_collect_colis', 'validation_reception_admin'].includes(eventKey)) return <Package className="w-4 h-4" />;
    if (['upload'].includes(eventKey)) return <Package className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  // Determine overall status
  const overallStatus = result ? getOverallStatus(result.activity) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-royal-600 hover:text-royal-700 font-medium mb-8 transition-colors">
        <ArrowRight className="w-4 h-4" />
        <span>العودة للرئيسية</span>
      </button>

      {/* Header */}
      <div className="text-center mb-10 animate-fade-in-up">
        <div className="w-20 h-20 bg-royal-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Package className="w-10 h-10 text-royal-600" />
        </div>
        <h1 className="text-3xl font-black text-royal-900 mb-2">تتبع طلبك</h1>
        <p className="text-gray-500">أدخل رقم التتبع لمتابعة حالة طلبك عبر Noest</p>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={trackingNumber}
              onChange={e => { setTrackingNumber(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleTrack()}
              placeholder="أدخل رقم التتبع..."
              className="w-full pr-12 pl-4 py-4 rounded-xl border-2 border-gray-200 focus:border-royal-500 focus:ring-2 focus:ring-royal-100 outline-none transition-all text-sm"
              dir="ltr"
            />
          </div>
          <button
            onClick={handleTrack}
            disabled={loading}
            className="bg-royal-600 hover:bg-royal-700 disabled:bg-royal-400 text-white px-8 py-4 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري البحث</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>تتبع</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3 animate-fade-in-up">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}
      </div>

      {/* Tracking Result */}
      {result && overallStatus && (
        <div className="space-y-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          {/* Status Card */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-l from-royal-700 to-royal-600 p-6 text-white">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-royal-200/70 text-sm mb-1">رقم التتبع</p>
                  <p className="text-xl font-black tracking-wider" dir="ltr">{result.tracking}</p>
                </div>
                <div className={`px-4 py-2 rounded-full text-sm font-bold border ${getStatusBadgeColor(overallStatus.status)}`}>
                  {overallStatus.statusAr}
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Order Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">تاريخ الإنشاء</p>
                  <p className="text-xs font-bold text-royal-800">{formatDate(result.createdAt)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">التوصيل المتوقع</p>
                  <p className="text-sm font-bold text-royal-800">{getEstimatedDays(result.wilayaId)} أيام</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">الوجهة</p>
                  <p className="text-sm font-bold text-royal-800">{getWilayaName(result.wilayaId)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">المبلغ</p>
                  <p className="text-sm font-bold text-royal-800">{result.amount} د.ج</p>
                </div>
              </div>

              {/* Recipient Info */}
              <div className="bg-royal-50 rounded-xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-royal-600" />
                  <div>
                    <p className="text-[10px] text-royal-500">المستلم</p>
                    <p className="text-sm font-bold text-royal-800">{result.client}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-royal-600" />
                  <div>
                    <p className="text-[10px] text-royal-500">العنوان</p>
                    <p className="text-sm font-bold text-royal-800">{result.commune}</p>
                  </div>
                </div>
                {result.driverName && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-royal-600" />
                    <div>
                      <p className="text-[10px] text-royal-500">السائق</p>
                      <p className="text-sm font-bold text-royal-800">{result.driverName}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  {[
                    { key: 'pending', label: 'إنشاء', icon: '📦' },
                    { key: 'confirmed', label: 'تأكيد', icon: '✅' },
                    { key: 'picked_up', label: 'استلام', icon: '🏪' },
                    { key: 'in_transit', label: 'توصيل', icon: '🚚' },
                    { key: 'delivered', label: 'تسليم', icon: '🎉' },
                  ].map((step, i) => {
                    const stages = ['pending', 'confirmed', 'picked_up', 'in_transit', 'delivered'];
                    const currentIdx = stages.indexOf(overallStatus.status);
                    const isActive = i <= currentIdx;
                    const isCurrent = i === currentIdx;
                    return (
                      <div key={step.key} className="flex flex-col items-center flex-1">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-lg sm:text-xl mb-1 transition-all ${
                          isCurrent
                            ? 'bg-royal-600 text-white ring-4 ring-royal-200 scale-110'
                            : isActive
                              ? 'bg-royal-100 text-royal-600'
                              : 'bg-gray-100 text-gray-400'
                        }`}>
                          {step.icon}
                        </div>
                        <span className={`text-[10px] sm:text-xs font-medium ${isActive ? 'text-royal-700' : 'text-gray-400'}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="relative h-2 bg-gray-100 rounded-full mx-5 sm:mx-6">
                  {(() => {
                    const stages = ['pending', 'confirmed', 'picked_up', 'in_transit', 'delivered'];
                    const idx = stages.indexOf(overallStatus.status);
                    const pct = Math.max(0, (idx / (stages.length - 1)) * 100);
                    return (
                      <div
                        className="absolute top-0 right-0 h-full bg-gradient-to-l from-royal-600 to-royal-400 rounded-full transition-all duration-1000"
                        style={{ width: `${pct}%` }}
                      />
                    );
                  })()}
                </div>
              </div>

              {/* Activity Timeline */}
              <div>
                <h3 className="font-bold text-royal-800 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  سجل التحديثات ({result.activity.length})
                </h3>
                <div className="space-y-0">
                  {result.activity.map((act, i) => (
                    <div key={i} className="flex gap-4">
                      {/* Timeline line + dot */}
                      <div className="flex flex-col items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          i === 0 ? getActivityBadgeColor(act.badgeClass) : 'bg-gray-100 text-gray-400'
                        }`}>
                          {getActivityIcon(act.eventKey)}
                        </div>
                        {i < result.activity.length - 1 && (
                          <div className="w-0.5 h-full min-h-[32px] bg-gray-200 my-1" />
                        )}
                      </div>

                      {/* Content */}
                      <div className={`pb-5 ${i === 0 ? '' : 'opacity-70'}`}>
                        <h4 className={`font-bold text-sm ${i === 0 ? 'text-royal-800' : 'text-gray-600'}`}>
                          {eventToArabic(act.eventKey, act.event)}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">{act.event}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(act.date)}
                          </span>
                          {act.causer && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              {act.causer}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Info */}
              {result.product && (
                <div className="mt-4 bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">المنتجات</p>
                  <p className="text-sm font-bold text-royal-800">{result.product}</p>
                </div>
              )}
            </div>
          </div>

          {/* Help Section */}
          <div className="bg-royal-50 rounded-2xl p-6 border border-royal-100">
            <h3 className="font-bold text-royal-800 mb-3">تحتاج مساعدة؟</h3>
            <p className="text-sm text-royal-600 mb-4">
              إذا كان لديك أي استفسار حول طلبك، لا تتردد في التواصل معنا
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="tel:0555000000"
                className="inline-flex items-center gap-2 bg-royal-600 hover:bg-royal-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
              >
                📞 اتصل بنا
              </a>
              <a
                href="https://wa.me/213555000000"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
              >
                💬 واتساب
              </a>
            </div>
          </div>
        </div>
      )}

      {/* If searched but no result and no error */}
      {searched && !result && !error && !loading && (
        <div className="text-center py-12 animate-fade-in-up">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-gray-400">لم يتم العثور على نتائج</h3>
          <p className="text-sm text-gray-400 mt-2">تأكد من رقم التتبع وحاول مرة أخرى</p>
        </div>
      )}

      {/* Info if not searched yet */}
      {!searched && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="w-14 h-14 bg-royal-100 rounded-2xl flex items-center justify-center mx-auto">
                <span className="text-2xl">📧</span>
              </div>
              <h4 className="font-bold text-royal-800 text-sm">أين أجد رقم التتبع؟</h4>
              <p className="text-xs text-gray-500">ستتلقى رقم التتبع عبر SMS بعد شحن طلبك</p>
            </div>
            <div className="space-y-3">
              <div className="w-14 h-14 bg-gold-100 rounded-2xl flex items-center justify-center mx-auto">
                <span className="text-2xl">⏱️</span>
              </div>
              <h4 className="font-bold text-royal-800 text-sm">متى يتم التحديث؟</h4>
              <p className="text-xs text-gray-500">يتم تحديث حالة الطلب فوراً عند كل مرحلة عبر Noest</p>
            </div>
            <div className="space-y-3">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
                <span className="text-2xl">🚚</span>
              </div>
              <h4 className="font-bold text-royal-800 text-sm">مدة التوصيل</h4>
              <p className="text-xs text-gray-500">24-72 ساعة حسب الولاية عبر Noest</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
