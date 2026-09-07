import { useEffect, useState } from 'react';
import AiLandingGenerator from './AiLandingGenerator';

function isLandingPagesSectionVisible() {
  if (!window.location.pathname.startsWith('/admin')) return false;
  if (!localStorage.getItem('almiraj_token')) return false;

  const headings = Array.from(
    document.querySelectorAll<HTMLElement>('h1, h2, h3, [role="heading"]'),
  );

  return headings.some((heading) => {
    const text = (heading.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text.includes('صفحات الهبوط')) return false;
    const style = window.getComputedStyle(heading);
    return style.display !== 'none' && style.visibility !== 'hidden' && heading.getClientRects().length > 0;
  });
}

export default function AiLandingGeneratorGate() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;

    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setVisible(isLandingPagesSectionVisible());
      });
    };

    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden'],
    });

    window.addEventListener('popstate', refresh);
    window.addEventListener('hashchange', refresh);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('popstate', refresh);
      window.removeEventListener('hashchange', refresh);
    };
  }, []);

  if (!visible) return null;
  return <AiLandingGenerator />;
}
