# HackGB
This is my project for HackGB.

Where all the data comes from: [DATA_SOURCES.md](DATA_SOURCES.md)

## Running it

```bash
cd web
npm install
npm run dev        # then open http://localhost:3000
```

## Settings (`web/.env.local`)

Create `web/.env.local` (git ignores it, so keys never reach GitHub):

```
GEMINI_API_KEY=your-gemini-key        # Ruby's chat answers (get one at aistudio.google.com)
FORUM_COMPANY_CODE=pick-a-secret-code # lets companies reply in the forum
GEMINI_MODEL=gemini-3.5-flash-lite    # optional: which Gemini model Ruby uses
```

Without `GEMINI_API_KEY`, Ruby still guides visitors through the cities and factories but can't answer typed
questions. Without `FORUM_COMPANY_CODE`, visitors can comment in the forum but companies can't reply.
Forum comments are saved in `cities/<city>/<company>/forum.json` (also kept out of git).
