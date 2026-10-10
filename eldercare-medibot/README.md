## ElderCare MediBot

Senior-friendly medical help chatbot inspired by the idea of *NalaFaad*, built from scratch.

### What it does (MVP)

- Chat UI optimized for readability (large text, clear sections)
- Simple **symptom triage** (emergency / urgent / self-care)
- Emergency guidance prompts (call local emergency number, stay safe while waiting)

> Note: This demo does **not** use an external LLM API; it runs offline with rule-based triage.
> You can later swap in OpenAI/Gemini/etc. behind the same `/api/chat` endpoint.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Project structure

- `src/app/page.tsx` – chat UI
- `src/app/api/chat/route.ts` – API route for chat replies
- `src/lib/triage.ts` – triage rules
- `src/lib/bot.ts` – response generator (currently rule-based)

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
