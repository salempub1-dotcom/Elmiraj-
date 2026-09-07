# Al Miraj AI Store Assistant

## What this MVP does

- Adds a floating customer chat widget to the storefront.
- Reads live product facts from the existing Supabase `products` table.
- Retrieves the most relevant products for each customer question.
- Sends only that grounded store context to an NVIDIA NIM chat model.
- Supports Arabic, Algerian Darija, French, English, and mixed messages.
- Explicitly forbids inventing prices, stock, promotions, delivery times, or product contents.
- Keeps the NVIDIA API key server-side in the Vercel function.

## Required Vercel environment variables

Add these in the Vercel project settings:

```text
NVIDIA_API_KEY=<your NVIDIA API key>
NVIDIA_MODEL=meta/llama-3.1-8b-instruct
```

The project already uses Supabase environment variables. The assistant API accepts either:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

or the existing public configuration:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Prefer the service-role key only as a server-side Vercel environment variable. Never expose it with a `VITE_` prefix.

## Endpoint

```text
POST /api/ai-assistant
Content-Type: application/json
```

Example request:

```json
{
  "message": "واش عندكم للسنة الرابعة ابتدائي؟",
  "history": []
}
```

## Current retrieval strategy

The MVP deliberately starts simple: it ranks live product records by terms found in product name, description, category, level, badge, benefits, and contents. It sends at most 8 products to the LLM.

This is cheaper and easier to validate than adding embeddings immediately. A later version can add a dedicated FAQ/knowledge table plus semantic embeddings/RAG for delivery policies, detailed educational explanations, and long product documents.

## Recommended next steps

1. Test real customer questions in Darija, Arabic, French, and English.
2. Add a `store_faq` table for delivery, ordering, payment, returns, and institutional policies.
3. Add analytics for unanswered questions and customer intents.
4. Add product CTA cards/links to assistant replies.
5. Add rate limiting and abuse controls before high-traffic rollout.
6. Add semantic retrieval if the knowledge base grows beyond structured product fields.
