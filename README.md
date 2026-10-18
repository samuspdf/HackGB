Gunk Radar
## Inspiration
My inspiration for this project came from the fact that I had never built a visual interactive map because I didn't have time before, and I thought a 24-hour hackathon would be a perfect place to make my first project in this field since I had a lot of mentors around me to help me if I ran into any issues.

## What is it?
Gunk Radar is an interactive 3D map of Wisconsin. It shows industrial pollution around Green Bay, Manitowoc, Sheboygan, and Milwaukee by focusing on three major factories in each city. These three factories of choice are the leading causes of pollution in each city according to publicly available data. Using EPA Toxics Release Inventory data, it highlights the top-releasing factories in each city, what they emit, and how those chemicals affect nearby air, water and communities. It aims to make environmental data easy to explore.

## Which Code Editor was used?
I made this project primarily using Visual Studio. I also tried other technologies like Loveable and Modal, but I found that Claude Code worked best with Visual Studio.

## Challenges
The Challenges I ran into were finding accurate data at first, and the other main challenge I ran into was loading the visual textures. Since I was using a graphics-intensive front end, it was really slow to develop the front end. It took 80% of my time fixing bugs and aligning everything. 

## Accomplishments
I am really proud of the fact that I built a graphics-intensive, interactive front-end design that was in the theme of environment and sustainability.

## Learnings
I learned about making an end-to-end web app that is interactive and visually engaging. I learnt a lot about software design and how that affects user retention.


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
questions. Without `FORUM_COMPANY_CODE`, neighbors can message the factories in the forum, but companies can't reply
(with it, a company opens its chat, taps "Reply as the company" and enters the code).
Forum messages are saved in `cities/<city>/<company>/forum.json` (also kept out of git).
