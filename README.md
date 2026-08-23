# CerevityAI Partnership Assistant — Static (HTML/CSS/JS) Version

A zero-build, zero-dependency version of the CerevityAI chatbot: plain
`index.html` + `style.css` + `script.js`, plus one small Vercel serverless
function (`api/chat.js`) that securely calls the Gemini API. No Next.js, no
npm install of any package, no build step — this avoids the folder-nesting
issues that come with framework projects, so it's about as simple as a
Vercel deploy gets.

## 📁 Files

```
cerevityai-static/
├── index.html       # Page structure
├── style.css         # All styling (navy/blue "tech partner" theme)
├── script.js          # Chat logic — calls /api/chat
├── api/
│   └── chat.js          # Vercel serverless function → calls Gemini REST API
├── package.json          # Just metadata — no dependencies
├── .env.example
├── .gitignore
└── README.md
```

There is only ONE folder here (`api`), so there's very little room for the
"double-nested folder" mistake that happens with deeper project structures.

## 🔑 Get a Gemini API key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey), sign in.
2. Click **Create API key**.
3. Copy it — looks like `AIzaSy...`.

## 🚀 Deploy to Vercel

1. Push this folder to a GitHub repo (all 8 items: `index.html`, `style.css`,
   `script.js`, `api/chat.js`, `package.json`, `.env.example`, `.gitignore`,
   `README.md`).
2. Go to [vercel.com/new](https://vercel.com/new) → import that repo.
3. Vercel will detect it as a static project with a serverless function —
   **no special build settings needed** (leave everything default).
4. Before/after deploying, add the environment variable:
   - `Project → Settings → Environment Variables`
   - `GEMINI_API_KEY` = your real key (Production, Preview, Development)
5. Deploy. If you added the key after the first deploy, go to
   **Deployments → "..." → Redeploy**.

## 🖥️ Test locally (optional)

You need the [Vercel CLI](https://vercel.com/docs/cli) to run the
serverless function locally (a plain double-click on `index.html` won't
run `/api/chat`):

```bash
npm install -g vercel
vercel dev
```

Copy `.env.example` to `.env` and fill in your key first.

## ✏️ Customizing

- **Persona / program facts / pricing**: edit the `SYSTEM_PROMPT` constant
  near the top of `api/chat.js`.
- **Suggested reply chips / welcome message**: edit the constants near the
  top of `script.js`.
- **WhatsApp number**: edit the `href` on the `.wa-btn` link in `index.html`
  (currently `https://wa.me/917301671108`).
- **Colors / design**: edit the CSS variables at the top of `style.css`.

## 🔒 Security

`GEMINI_API_KEY` is read only inside `api/chat.js`, which runs server-side
as a Vercel serverless function. It is never sent to the browser.
