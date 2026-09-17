# Offline departures

PWA I made to tell me the next departures according to the time-table. Works completely offline using cached data (after initial load).

### Why offline?

I'm often in a position where I'd like to know the next train home without a network connection, so I wanted to make something that could quickly tell me the next 5 departing trains in my direction.

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## AI use disclosure

Some LLMs were used while I was working on this, as I'm not very familiar with the service worker APIs, and I wasn't able to find great documentation. The project isn't hands-off ["vibe coded"](https://en.wikipedia.org/wiki/Vibe_coding), but was helped via LLMs.
