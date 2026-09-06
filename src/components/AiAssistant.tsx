import { FormEvent, useEffect, useRef, useState } from 'react';
import './AiAssistant.css';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AssistantErrorData = {
  error?: string;
  provider_status?: number;
  provider_message?: string;
  model?: string;
};

const WELCOME: ChatMessage = {
  role: 'assistant',
  content: 'السلام عليكم 🌟 أنا مساعد المعراج. نقدر نعاونك تعرف منتجات المتجر، الأسعار، المحتويات ونختاروا معًا المنتج المناسب ليك.',
};

const QUICK_QUESTIONS = [
  'شنو عندكم للسنة الرابعة ابتدائي؟',
  'واش البطاقات ممغنطة؟',
  'ساعدني نختار المنتج المناسب',
];

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(raw: string) {
    const message = raw.trim();
    if (!message || loading) return;

    const previous = messages.filter((m) => m !== WELCOME).slice(-8);
    const userMessage: ChatMessage = { role: 'user', content: message };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);

    let failureData: AssistantErrorData | null = null;

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_assistant', message, history: previous }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        failureData = data || {};
        throw new Error(data?.error || 'Request failed');
      }

      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.answer },
      ]);
    } catch (error) {
      console.error('AI assistant error:', error, failureData);
      const diagnostic = failureData
        ? [
            failureData.error,
            failureData.provider_status ? `NVIDIA ${failureData.provider_status}` : null,
            failureData.provider_message,
            failureData.model ? `model: ${failureData.model}` : null,
          ].filter(Boolean).join(' | ')
        : 'NETWORK_OR_PARSE_ERROR';

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `سمحلي، المساعد غير متاح مؤقتًا.\n\nرمز التشخيص: ${diagnostic}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="miraj-ai" dir="rtl">
      {open && (
        <section className="miraj-ai__panel" aria-label="مساعد المعراج">
          <header className="miraj-ai__header">
            <div className="miraj-ai__identity">
              <div className="miraj-ai__avatar" aria-hidden="true">🤖</div>
              <div>
                <strong>مساعد المعراج</strong>
                <span>مساعد المنتجات الذكي</span>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق">
              ×
            </button>
          </header>

          <div className="miraj-ai__messages">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`miraj-ai__message miraj-ai__message--${message.role}`}
              >
                {message.content}
              </div>
            ))}

            {messages.length === 1 && (
              <div className="miraj-ai__quick">
                {QUICK_QUESTIONS.map((question) => (
                  <button key={question} type="button" onClick={() => void sendMessage(question)}>
                    {question}
                  </button>
                ))}
              </div>
            )}

            {loading && <div className="miraj-ai__typing">يكتب الآن…</div>}
            <div ref={endRef} />
          </div>

          <form className="miraj-ai__form" onSubmit={submit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="اكتب سؤالك حول المنتجات…"
              maxLength={1200}
              disabled={loading}
              aria-label="رسالتك"
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="إرسال">
              إرسال
            </button>
          </form>

          <p className="miraj-ai__note">المساعد يجيب اعتمادًا على معلومات منتجات متجر المعراج.</p>
        </section>
      )}

      <button
        className="miraj-ai__launcher"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'إغلاق مساعد المعراج' : 'فتح مساعد المعراج'}
        title="مساعد المعراج"
      >
        <span aria-hidden="true">🤖</span>
      </button>
    </div>
  );
}
