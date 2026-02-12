import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowRight, Truck, Check, Phone, User, MapPin, Home, Building2,
  Package, ShieldCheck, Minus, Plus, Trash2, ChevronDown, Loader2, Search
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import {
  fetchWilayas, fetchCommunes, fetchFees, fetchDesks,
  getDeliveryFee, getEstimatedDays, createOrder,
  getWilayaName, isStopDeskAvailable,
  type NoestWilaya, type NoestCommune, type NoestDesk, type ApiDesk
} from '../services/noest';

interface CheckoutProps {
  onBack: () => void;
}

export function Checkout({ onBack }: CheckoutProps) {
  const { items, totalPrice, clearCart, updateQuantity, removeFromCart } = useCart();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedWilayaId, setSelectedWilayaId] = useState(16);
  const [selectedCommune, setSelectedCommune] = useState('');
  const [isHomeDelivery, setIsHomeDelivery] = useState(true);
  const [selectedDeskCode, setSelectedDeskCode] = useState('');

  // UI state
  const [wilayaOpen, setWilayaOpen] = useState(false);
  const [wilayaSearch, setWilayaSearch] = useState('');
  const [communeOpen, setCommuneOpen] = useState(false);
  const [communeSearch, setCommuneSearch] = useState('');

  // Data from API
  const [wilayas, setWilayas] = useState<NoestWilaya[]>([]);
  const [communes, setCommunes] = useState<NoestCommune[]>([]);
  const [desks, setDesks] = useState<NoestDesk[]>([]);
  const [loadingCommunes, setLoadingCommunes] = useState(false);
  const [loadingDesks, setLoadingDesks] = useState(false);
  const [feesLoaded, setFeesLoaded] = useState(false);

  // Order state
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderTracking, setOrderTracking] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [orderError, setOrderError] = useState('');

  // ============ Load initial data ============
  useEffect(() => {
    const init = async () => {
      const [wilayaData] = await Promise.all([
        fetchWilayas(),
        fetchFees().then(() => setFeesLoaded(true)),
      ]);
      setWilayas(wilayaData);
    };
    init();
  }, []);

  // ============ Check stop desk availability ============
  const stopDeskAvailable = isStopDeskAvailable(selectedWilayaId);

  // ============ Load communes when wilaya changes ============
  useEffect(() => {
    setSelectedCommune('');
    setCommuneSearch('');
    setLoadingCommunes(true);
    // Auto-switch to home delivery if stop desk not available
    if (!isStopDeskAvailable(selectedWilayaId)) {
      setIsHomeDelivery(true);
    }
    fetchCommunes(selectedWilayaId)
      .then(data => {
        setCommunes(data);
        setLoadingCommunes(false);
      })
      .catch(() => setLoadingCommunes(false));
  }, [selectedWilayaId]);

  // ============ Load desks when stop desk selected ============
  useEffect(() => {
    if (!isHomeDelivery) {
      setLoadingDesks(true);
      setSelectedDeskCode('');
      const wilayaCode = String(selectedWilayaId).padStart(2, '0');
      fetchDesks().then(allDesks => {
        const wilayaDesks: NoestDesk[] = Object.entries(allDesks)
          .filter(([key]) => key.startsWith(wilayaCode))
          .map(([, desk]: [string, ApiDesk]) => ({
            code: desk.code,
            name: desk.name,
            address: desk.address,
            phones: Object.values(desk.phones).filter(p => p && p.trim() !== ''),
            email: desk.email,
          }));
        setDesks(wilayaDesks);
        if (wilayaDesks.length > 0) {
          setSelectedDeskCode(wilayaDesks[0].code);
        }
        setLoadingDesks(false);
      }).catch(() => setLoadingDesks(false));
    }
  }, [isHomeDelivery, selectedWilayaId]);

  // ============ Computed values ============
  const deliveryFee = useMemo(() => {
    void feesLoaded; // trigger recalc when fees load
    return getDeliveryFee(selectedWilayaId, isHomeDelivery);
  }, [selectedWilayaId, isHomeDelivery, feesLoaded]);

  const estimatedDays = useMemo(() => getEstimatedDays(selectedWilayaId), [selectedWilayaId]);
  const freeShipping = totalPrice >= 5000;
  const shippingCost = freeShipping ? 0 : deliveryFee;
  const total = totalPrice + shippingCost;

  const selectedWilaya = useMemo(
    () => wilayas.find(w => w.id === selectedWilayaId) || { id: selectedWilayaId, name: '', nameAr: getWilayaName(selectedWilayaId), isActive: true },
    [wilayas, selectedWilayaId]
  );

  const isFormValid = firstName.trim() && lastName.trim() && phone.trim().length >= 9 && (selectedCommune || communes.length === 0);

  const filteredWilayas = useMemo(() => {
    const list = wilayas.length > 0 ? wilayas : [];
    if (!wilayaSearch.trim()) return list;
    const s = wilayaSearch.toLowerCase();
    return list.filter(w =>
      w.nameAr.includes(wilayaSearch) ||
      w.name.toLowerCase().includes(s) ||
      String(w.id).includes(wilayaSearch)
    );
  }, [wilayas, wilayaSearch]);

  const filteredCommunes = useMemo(() => {
    if (!communeSearch.trim()) return communes;
    const s = communeSearch.toLowerCase();
    return communes.filter(c => c.name.toLowerCase().includes(s));
  }, [communes, communeSearch]);

  // ============ Place Order ============
  const handlePlaceOrder = useCallback(async () => {
    if (!isFormValid || submitting) return;
    setSubmitting(true);
    setOrderError('');

    try {
      const clientName = `${firstName.trim()} ${lastName.trim()}`;
      const productNames = items.map(item =>
        `${item.product.name} x${item.quantity}`
      ).join(', ');

      const reference = `MRJ${Date.now().toString(36).toUpperCase()}`;

      const communeName = selectedCommune || selectedWilaya.nameAr;

      const result = await createOrder({
        clientName,
        phone: phone.trim(),
        address: communeName,
        wilayaId: selectedWilayaId,
        commune: communeName,
        montant: total,
        products: productNames,
        stopDesk: !isHomeDelivery,
        stationCode: !isHomeDelivery && selectedDeskCode ? selectedDeskCode : undefined,
        reference,
        remarque: `طلب من متجر المعراج - ${items.length} منتج`,
      });

      if (result.success && result.tracking) {
        // لا نقوم بالتأكيد التلقائي - الطلب يبقى كمسودة
        // حتى يتم تأكيده يدوياً من تطبيق Noest
        setOrderTracking(result.tracking);
        setOrderRef(result.reference || reference);
        setOrderPlaced(true);
        clearCart();
      } else {
        // If the API returned an error, show it
        setOrderError('حدث خطأ أثناء إنشاء الطلب. سيتم التواصل معك قريباً.');
        // Still place the order locally
        setOrderTracking(reference);
        setOrderRef(reference);
        setOrderPlaced(true);
        clearCart();
      }
    } catch {
      setOrderError('تم تسجيل طلبك. سيتم التواصل معك لتأكيد الطلب.');
      const ref = `MRJ${Date.now().toString(36).toUpperCase()}`;
      setOrderTracking(ref);
      setOrderRef(ref);
      setOrderPlaced(true);
      clearCart();
    } finally {
      setSubmitting(false);
    }
  }, [isFormValid, submitting, firstName, lastName, phone, selectedWilayaId, selectedCommune, selectedWilaya, total, items, isHomeDelivery, selectedDeskCode, clearCart]);

  // ============ ORDER CONFIRMED ============
  if (orderPlaced) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="text-center space-y-6 animate-scale-in max-w-lg w-full">
          <div className="relative w-28 h-28 mx-auto">
            <div className="absolute inset-0 bg-green-200 rounded-full animate-ping opacity-30" />
            <div className="relative w-28 h-28 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-xl shadow-green-200">
              <Check className="w-14 h-14 text-white" strokeWidth={3} />
            </div>
          </div>

          <h2 className="text-3xl font-black text-royal-900">تم استلام طلبك بنجاح! 🎉</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            شكراً لتسوقك من <span className="font-bold text-royal-700">المعراج</span>.<br />
            طلبك قيد المراجعة وسيتم تأكيده وشحنه في أقرب وقت.
          </p>

          {orderError && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">{orderError}</div>
          )}

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-right space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-royal-50 rounded-xl p-3">
                <span className="text-xs text-royal-600 block mb-1">رقم الطلب</span>
                <p className="font-black text-royal-800 text-xs break-all" dir="ltr">{orderRef}</p>
              </div>
              <div className="bg-royal-50 rounded-xl p-3">
                <span className="text-xs text-royal-600 block mb-1">رقم التتبع</span>
                <p className="font-black text-royal-800 text-xs break-all" dir="ltr">{orderTracking}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="bg-green-50 text-green-700 px-3 py-1.5 rounded-lg font-medium">💰 الدفع عند الاستلام</span>
              <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-medium">
                🚚 Noest • {estimatedDays} أيام
              </span>
              <span className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg font-medium">
                {isHomeDelivery ? '🏠 توصيل للمنزل' : '🏢 توصيل للمكتب'}
              </span>
            </div>

            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
              <span className="text-sm text-gray-500">المبلغ عند الاستلام</span>
              <span className="text-2xl font-black text-royal-700">{total} د.ج</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-medium">
            💡 سيتم مراجعة طلبك وتأكيده، ثم ستتلقى رسالة SMS برقم التتبع لمتابعة طلبك عبر Noest
          </div>

          <button
            onClick={onBack}
            className="bg-royal-600 hover:bg-royal-700 text-white px-10 py-3.5 rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            العودة للتسوق
          </button>
        </div>
      </div>
    );
  }

  // ============ EMPTY CART ============
  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center space-y-5">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <Package className="w-10 h-10 text-gray-300" />
          </div>
          <h2 className="text-2xl font-black text-gray-300">السلة فارغة</h2>
          <p className="text-sm text-gray-400">أضف منتجات للسلة أولاً</p>
          <button onClick={onBack} className="bg-royal-600 hover:bg-royal-700 text-white px-8 py-3 rounded-xl font-bold transition-all">
            تصفح المنتجات
          </button>
        </div>
      </div>
    );
  }

  // ============ CHECKOUT PAGE ============
  return (
    <div className="min-h-screen bg-gray-50/30">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-royal-600 hover:text-royal-700 font-medium transition-colors text-sm">
            <ArrowRight className="w-4 h-4" />
            <span>مواصلة التسوق</span>
          </button>
          <h1 className="text-lg font-black text-royal-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-royal-600" />
            إتمام الطلب
          </h1>
          <div className="w-24" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">

          {/* ========== RIGHT: ORDER FORM (3 cols) ========== */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Form Header */}
              <div className="bg-gradient-to-l from-royal-600 to-royal-700 px-6 py-4">
                <h2 className="text-white font-bold flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5" />
                  معلومات الطلب
                </h2>
                <p className="text-royal-100/70 text-xs mt-1">أدخل بياناتك لتوصيل طلبك عبر Noest</p>
              </div>

              <div className="p-5 md:p-6 space-y-5">
                {/* Name Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                      <User className="w-4 h-4 text-royal-500" />
                      الاسم <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="مثال: محمد"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 focus:ring-4 focus:ring-royal-100 outline-none transition-all text-sm bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                      <User className="w-4 h-4 text-royal-500" />
                      اللقب <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="مثال: بوعلام"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 focus:ring-4 focus:ring-royal-100 outline-none transition-all text-sm bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                    <Phone className="w-4 h-4 text-royal-500" />
                    رقم الهاتف <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                      placeholder="0550000000"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 focus:ring-4 focus:ring-royal-100 outline-none transition-all text-sm bg-gray-50 focus:bg-white pl-16"
                      dir="ltr"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium bg-gray-200 px-2 py-1 rounded-md">+213</span>
                  </div>
                </div>

                {/* Wilaya - Custom Select with Search */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 text-royal-500" />
                    الولاية <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setWilayaOpen(!wilayaOpen); setCommuneOpen(false); }}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm bg-gray-50 text-right flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <span className="bg-royal-100 text-royal-700 text-xs font-bold px-2 py-0.5 rounded-lg">
                          {String(selectedWilayaId).padStart(2, '0')}
                        </span>
                        <span className="font-medium text-gray-800">{selectedWilaya.nameAr}</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${wilayaOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {wilayaOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => { setWilayaOpen(false); setWilayaSearch(''); }} />
                        <div className="absolute z-50 top-full mt-2 w-full bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden max-h-72">
                          <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                            <div className="relative">
                              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={wilayaSearch}
                                onChange={e => setWilayaSearch(e.target.value)}
                                placeholder="ابحث عن الولاية..."
                                className="w-full pr-9 pl-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-royal-400"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="overflow-y-auto max-h-52">
                            {filteredWilayas.map(w => (
                              <button
                                key={w.id}
                                type="button"
                                onClick={() => {
                                  setSelectedWilayaId(w.id);
                                  setWilayaOpen(false);
                                  setWilayaSearch('');
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-royal-50 transition-colors text-right ${
                                  selectedWilayaId === w.id ? 'bg-royal-50 text-royal-700' : 'text-gray-700'
                                }`}
                              >
                                <span className="text-xs font-bold text-gray-400 w-6">{String(w.id).padStart(2, '0')}</span>
                                <span className="flex-1 font-medium">{w.nameAr}</span>
                                <span className="text-[10px] text-gray-400">🏠 {getDeliveryFee(w.id, true)} د.ج</span>
                                {selectedWilayaId === w.id && <Check className="w-4 h-4 text-royal-600" />}
                              </button>
                            ))}
                            {filteredWilayas.length === 0 && (
                              <div className="p-4 text-center text-sm text-gray-400">لا توجد نتائج</div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Commune - Custom Select with Search */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                    <Building2 className="w-4 h-4 text-royal-500" />
                    البلدية <span className="text-red-400">*</span>
                  </label>
                  {loadingCommunes ? (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 text-sm text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري تحميل البلديات...
                    </div>
                  ) : communes.length > 0 ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => { setCommuneOpen(!communeOpen); setWilayaOpen(false); }}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 outline-none transition-all text-sm bg-gray-50 text-right flex items-center justify-between"
                      >
                        <span className={`font-medium ${selectedCommune ? 'text-gray-800' : 'text-gray-400'}`}>
                          {selectedCommune || 'اختر البلدية'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${communeOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {communeOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => { setCommuneOpen(false); setCommuneSearch(''); }} />
                          <div className="absolute z-50 top-full mt-2 w-full bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden max-h-64">
                            <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
                              <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  value={communeSearch}
                                  onChange={e => setCommuneSearch(e.target.value)}
                                  placeholder="ابحث عن البلدية..."
                                  className="w-full pr-9 pl-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-royal-400"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="overflow-y-auto max-h-48">
                              {filteredCommunes.map((c, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCommune(c.name);
                                    setCommuneOpen(false);
                                    setCommuneSearch('');
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-royal-50 transition-colors text-right ${
                                    selectedCommune === c.name ? 'bg-royal-50 text-royal-700' : 'text-gray-700'
                                  }`}
                                >
                                  <span className="flex-1 font-medium">{c.name}</span>
                                  <span className="text-[10px] text-gray-400">{c.postalCode}</span>
                                  {selectedCommune === c.name && <Check className="w-4 h-4 text-royal-600" />}
                                </button>
                              ))}
                              {filteredCommunes.length === 0 && (
                                <div className="p-4 text-center text-sm text-gray-400">لا توجد نتائج</div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={selectedCommune}
                      onChange={e => setSelectedCommune(e.target.value)}
                      placeholder="اكتب اسم البلدية"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 focus:ring-4 focus:ring-royal-100 outline-none transition-all text-sm bg-gray-50 focus:bg-white"
                    />
                  )}
                </div>

                {/* Delivery Type */}
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-3">
                    <Truck className="w-4 h-4 text-royal-500" />
                    نوع التوصيل
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Home Delivery */}
                    <button
                      type="button"
                      onClick={() => setIsHomeDelivery(true)}
                      className={`relative border-2 rounded-2xl p-4 text-center transition-all group ${
                        isHomeDelivery
                          ? 'border-royal-500 bg-royal-50 shadow-lg shadow-royal-100'
                          : 'border-gray-200 hover:border-royal-300 bg-white'
                      }`}
                    >
                      {isHomeDelivery && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-royal-600 rounded-full flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        </div>
                      )}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 transition-colors ${
                        isHomeDelivery ? 'bg-royal-100' : 'bg-gray-100 group-hover:bg-royal-50'
                      }`}>
                        <Home className={`w-6 h-6 ${isHomeDelivery ? 'text-royal-600' : 'text-gray-400'}`} />
                      </div>
                      <p className={`text-sm font-bold ${isHomeDelivery ? 'text-royal-700' : 'text-gray-600'}`}>
                        توصيل للمنزل
                      </p>
                      <p className={`text-xs mt-1 font-medium ${isHomeDelivery ? 'text-royal-500' : 'text-gray-400'}`}>
                        {freeShipping ? (
                          <span className="text-green-600">مجاني ✨</span>
                        ) : (
                          <>{getDeliveryFee(selectedWilayaId, true)} د.ج</>
                        )}
                      </p>
                    </button>

                    {/* Stop Desk / Bureau */}
                    <button
                      type="button"
                      onClick={() => { if (stopDeskAvailable) setIsHomeDelivery(false); }}
                      disabled={!stopDeskAvailable}
                      className={`relative border-2 rounded-2xl p-4 text-center transition-all group ${
                        !stopDeskAvailable
                          ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                          : !isHomeDelivery
                            ? 'border-royal-500 bg-royal-50 shadow-lg shadow-royal-100'
                            : 'border-gray-200 hover:border-royal-300 bg-white'
                      }`}
                    >
                      {!isHomeDelivery && stopDeskAvailable && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-royal-600 rounded-full flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        </div>
                      )}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 transition-colors ${
                        !stopDeskAvailable
                          ? 'bg-gray-100'
                          : !isHomeDelivery ? 'bg-royal-100' : 'bg-gray-100 group-hover:bg-royal-50'
                      }`}>
                        <Building2 className={`w-6 h-6 ${
                          !stopDeskAvailable ? 'text-gray-300' : !isHomeDelivery ? 'text-royal-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <p className={`text-sm font-bold ${
                        !stopDeskAvailable ? 'text-gray-400' : !isHomeDelivery ? 'text-royal-700' : 'text-gray-600'
                      }`}>
                        توصيل للمكتب
                      </p>
                      <p className={`text-xs mt-1 font-medium ${
                        !stopDeskAvailable ? 'text-gray-400' : !isHomeDelivery ? 'text-royal-500' : 'text-gray-400'
                      }`}>
                        {!stopDeskAvailable ? (
                          <span className="text-red-400">غير متوفر ❌</span>
                        ) : freeShipping ? (
                          <span className="text-green-600">مجاني ✨</span>
                        ) : (
                          <>{getDeliveryFee(selectedWilayaId, false)} د.ج</>
                        )}
                      </p>
                    </button>
                  </div>

                  {/* No stop desk warning */}
                  {!stopDeskAvailable && !isHomeDelivery && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-700 font-medium">
                      ⚠️ التوصيل للمكتب غير متوفر في هذه الولاية. تم تحويلك تلقائياً للتوصيل المنزلي.
                    </div>
                  )}

                  {/* Stop Desk Stations */}
                  {!isHomeDelivery && (
                    <div className="mt-3 animate-fade-in-up">
                      {loadingDesks ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400 p-3 bg-gray-50 rounded-xl">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          جاري تحميل نقاط الاستلام...
                        </div>
                      ) : desks.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-500 font-medium">اختر نقطة الاستلام:</p>
                          {desks.map(desk => (
                            <button
                              key={desk.code}
                              type="button"
                              onClick={() => setSelectedDeskCode(desk.code)}
                              className={`w-full text-right rounded-xl p-3 border-2 transition-all ${
                                selectedDeskCode === desk.code
                                  ? 'border-royal-500 bg-royal-50'
                                  : 'border-gray-200 hover:border-royal-300 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold text-royal-800">📍 {desk.name}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">{desk.address}</p>
                                  {desk.phones.length > 0 && (
                                    <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{desk.phones[0]}</p>
                                  )}
                                </div>
                                {selectedDeskCode === desk.code && (
                                  <Check className="w-5 h-5 text-royal-600 flex-shrink-0" />
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                          ⚠️ لا توجد نقاط استلام متاحة في هذه الولاية. اختر توصيل للمنزل.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Delivery Info Bar */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-blue-800">
                      التوصيل عبر Noest إلى {selectedWilaya.nameAr}
                    </p>
                    <p className="text-[11px] text-blue-600 mt-0.5">
                      مدة التوصيل المتوقعة: {estimatedDays} أيام عمل
                      {!isHomeDelivery && selectedDeskCode && ` • نقطة ${desks.find(d => d.code === selectedDeskCode)?.name || ''}`}
                    </p>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  onClick={handlePlaceOrder}
                  disabled={!isFormValid || submitting}
                  className="w-full bg-gradient-to-l from-royal-600 to-royal-700 hover:from-royal-700 hover:to-royal-800 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold transition-all text-lg shadow-xl shadow-royal-200 hover:shadow-2xl hover:-translate-y-0.5 flex items-center justify-center gap-3"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      جاري إرسال الطلب...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      إرسال الطلب • {total} د.ج
                    </>
                  )}
                </button>

                {/* Trust Badges */}
                <div className="flex flex-wrap justify-center gap-4 text-[11px] text-gray-400 pt-1">
                  <span className="flex items-center gap-1">💰 الدفع عند الاستلام</span>
                  <span className="flex items-center gap-1">🔒 بياناتك آمنة</span>
                  <span className="flex items-center gap-1">🚚 Noest API</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========== LEFT: PRODUCTS SUMMARY (2 cols) ========== */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="lg:sticky lg:top-20 space-y-4">
              {/* Products Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-royal-800 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    طلبك
                  </h3>
                  <span className="text-xs bg-royal-100 text-royal-700 px-2.5 py-1 rounded-lg font-bold">
                    {items.reduce((s, i) => s + i.quantity, 0)} منتج
                  </span>
                </div>

                <div className="divide-y divide-gray-50">
                  {items.map(item => (
                    <div key={item.product.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex gap-3">
                        <div className="w-16 h-16 bg-gradient-to-br from-royal-50 to-royal-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
                          {item.product.image}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-royal-900 line-clamp-2 leading-snug">{item.product.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            {item.product.originalPrice && (
                              <span className="text-[11px] text-gray-400 line-through">{item.product.originalPrice} د.ج</span>
                            )}
                            <span className="text-xs font-bold text-royal-600">{item.product.price} د.ج</span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                              <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white transition-colors text-gray-500">
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center text-sm font-bold text-royal-800">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white transition-colors text-gray-500">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black text-royal-700">{item.product.price * item.quantity} د.ج</span>
                              <button onClick={() => removeFromCart(item.product.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Summary */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">المجموع الفرعي</span>
                  <span className="font-semibold text-gray-700">{totalPrice} د.ج</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    التوصيل
                    <span className="text-[10px] text-gray-400">({isHomeDelivery ? 'منزلي' : 'مكتب'})</span>
                  </span>
                  <span className={`font-semibold ${shippingCost === 0 ? 'text-green-600' : 'text-gray-700'}`}>
                    {shippingCost === 0 ? 'مجاني ✨' : `${shippingCost} د.ج`}
                  </span>
                </div>
                <div className="border-t-2 border-dashed border-gray-100 pt-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-royal-900 text-sm">الإجمالي</span>
                      <p className="text-[10px] text-green-600 font-medium mt-0.5">💰 الدفع عند الاستلام</p>
                    </div>
                    <span className="text-2xl font-black text-royal-700">{total} د.ج</span>
                  </div>
                </div>

                {freeShipping ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 text-center">
                    <span className="text-xs font-bold text-green-700">🎉 مبروك! توصيل مجاني</span>
                  </div>
                ) : (
                  <div className="bg-gradient-to-l from-gold-50 to-amber-50 border border-gold-200 rounded-xl p-2.5 text-center">
                    <span className="text-xs font-medium text-gold-800">
                      🎁 أضف <strong>{5000 - totalPrice} د.ج</strong> للحصول على توصيل مجاني
                    </span>
                    <div className="mt-2 bg-gold-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-l from-gold-500 to-gold-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((totalPrice / 5000) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Guarantees */}
              <div className="bg-royal-50 rounded-2xl p-4 space-y-2.5">
                {[
                  { icon: '🚚', text: 'توصيل Noest لجميع 58 ولاية' },
                  { icon: '💰', text: 'الدفع عند الاستلام - لا حاجة لبطاقة بنكية' },
                  { icon: '📦', text: 'تغليف آمن يحمي المنتجات' },
                  { icon: '🔄', text: 'إمكانية الإرجاع خلال 7 أيام' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs text-royal-700">
                    <span className="text-base">{item.icon}</span>
                    <span className="font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
