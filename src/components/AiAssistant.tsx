import { FormEvent, useEffect, useRef, useState } from 'react';
import './AiAssistant.css';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const WELCOME: ChatMessage = {
  role: 'assistant',
  content: 'مرحبًا 👋 أنا مساعد المعراج. نقدر نعاونك تختار المنتج المناسب ونجيبك على الأسئلة المتعلقة بمنتجات المتجر.',
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

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_assistant', message, history: previous }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Request failed');

      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.answer },
      ]);
    } catch (error) {
      console.error('AI assistant error:', error);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'سمحلي، المساعد غير متاح مؤقتًا. تقدر تعاود المحاولة بعد قليل أو تتواصل مع فريق المعراج.',
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
            <div>
              <strong>مساعد المعراج ✨</strong>
              <span>مساعد المنتجات الذكي</span>
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
        aria-label="فتح مساعد المعراج"
      >
        <span>✨</span>
        <b>اسأل مساعد المعراج</b>
      </button>
    </div>
  );
}
