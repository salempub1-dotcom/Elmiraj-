import { useEffect, useMemo, useState } from 'react';
import {
  STAGE_CHOICES,
  displayLevel,
  sortLevels,
  type ConversationState,
} from '../services/conversationEngine';

type StoreProduct = {
  id: number;
  name: string;
  category?: string;
  level?: string;
  stock?: number;
};

type Props = {
  conversation: ConversationState;
  disabled?: boolean;
  onSelect: (value: string) => void;
};

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function productShortName(name = '') {
  return String(name).split('|')[0].trim();
}

function normalizedLevel(level = '') {
  const upper = String(level).toUpperCase();
  if (upper.endsWith('AP')) return upper.replace('AP', 'PS');
  return upper;
}

export default function GuidedAssistantChoices({ conversation, disabled, onSelect }: Props) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const needsProducts = conversation.lastQuestionType === 'choose_level' || conversation.lastQuestionType === 'choose_product';

  useEffect(() => {
    if (conversation.lastQuestionType !== 'choose_product') setSelectedProductId(null);
  }, [conversation.lastQuestionType, conversation.currentLevel]);

  useEffect(() => {
    if (!needsProducts || products.length) return;
    let cancelled = false;
    setLoading(true);
    fetch('/api/products')
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.products)
            ? payload.products
            : Array.isArray(payload?.data)
              ? payload.data
              : [];
        setProducts(list);
      })
      .catch((error) => console.error('Guided assistant products error:', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [needsProducts, products.length]);

  const stageProducts = useMemo(() => {
    if (!conversation.currentStage) return products;
    const wanted = normalize(conversation.currentStage);
    return products.filter((product) => normalize(product.category || '') === wanted);
  }, [products, conversation.currentStage]);

  const levels = useMemo(() => {
    return sortLevels(stageProducts.map((product) => normalizedLevel(product.level || '')).filter(Boolean));
  }, [stageProducts]);

  const levelProducts = useMemo(() => {
    if (!conversation.currentLevel) return stageProducts;
    const wanted = normalizedLevel(conversation.currentLevel);
    return stageProducts.filter((product) => normalizedLevel(product.level || '') === wanted);
  }, [stageProducts, conversation.currentLevel]);

  if (conversation.lastQuestionType === 'choose_stage') {
    return (
      <div className="miraj-ai__checkout-actions" aria-label="اختيار الطور">
        {STAGE_CHOICES.map((stage) => (
          <button key={stage} type="button" disabled={disabled} onClick={() => onSelect(stage)}>
            {stage === 'تحضيري' ? '🧒' : stage === 'ابتدائي' ? '🎒' : '📘'} {stage}
          </button>
        ))}
      </div>
    );
  }

  if (conversation.lastQuestionType === 'choose_level') {
    if (loading) return <div className="miraj-ai__typing">نجيبلك السنوات المتاحة…</div>;
    if (!levels.length) return null;
    return (
      <div className="miraj-ai__checkout-actions" aria-label="اختيار السنة">
        {levels.map((level) => (
          <button key={level} type="button" disabled={disabled} onClick={() => onSelect(displayLevel(level))}>
            {displayLevel(level)}
          </button>
        ))}
      </div>
    );
  }

  if (conversation.lastQuestionType === 'choose_product' && conversation.currentLevel) {
    if (loading) return <div className="miraj-ai__typing">نجيبلك المنتجات المتوفرة…</div>;
    if (!levelProducts.length || selectedProductId !== null) return null;
    return (
      <div className="miraj-ai__checkout-actions miraj-ai__office-list" aria-label="اختيار المنتج">
        {levelProducts.slice(0, 8).map((product) => (
          <button
            key={product.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              setSelectedProductId(product.id);
              onSelect(productShortName(product.name));
            }}
          >
            📚 {productShortName(product.name)}
          </button>
        ))}
      </div>
    );
  }

  return null;
}
