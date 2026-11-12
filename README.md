# FacultyConnect — An Academic Collaboration Hub

A web platform for Thapar Institute that helps students find the right faculty member and
everything that faculty member has shared, in one place.

**Team:** Vani Tripathi (1024160073) · Agrim Mittal (1024160068) · Shriyam Bhardwaj (1024160062)
**Live:** https://faculty-connect-mu.vercel.app/

## Features
- Faculty directory with search and department filters
- Faculty profiles: About, **All work**, Research, Publications, Teaching, Assignments, Question bank, Students, Contact
- **All work timeline** — every upload, assignment, lecture unit and question in one list, newest first, grouped by month, filterable by type. Faculty can back-date older work so it lands in the right month.
- Assignments with automatic open/closed status and "Mark as done"
- Question bank with instant MCQ feedback
- Structured student → faculty messages with live notification
- AI faculty recommender and helpdesk chatbot (with keyword fallback when AI is unavailable)

## Project structure
```
facultyconnect/
├── index.html                 # page markup (login + app shell)
├── css/style.css              # all styles
├── js/data.js                 # seed data: faculty, courses, assignments, uploads
├── js/app.js                  # app logic: router, views, timeline, sync, AI
├── assets/images/             # images (faculty photo)
├── vercel.json                # Vercel static hosting config
└── docs/
    ├── report/                # 9-page IEEE report (LaTeX source + PDF)
    ├── report-detailed/       # detailed IEEE report (LaTeX source + PDF)
    └── screenshots/           # app screenshots
```

## Run locally
No build step. Either open `index.html` in a browser, or serve the folder:
```
npx serve .
```
Then open http://localhost:3000

## Deploy to Vercel
```
npm install -g vercel
vercel login
vercel link        # choose the existing project "faculty-connect"
vercel --prod
```
Or push this folder to the GitHub repo connected to the Vercel project — it redeploys automatically.

## Report
Upload `docs/report/` (zipped) to Overleaf → New Project → Upload Project. Compiler: pdfLaTeX.

## Notes
- Login is a demo role picker (no real Thapar credentials).
- On plain static hosting, data is saved per browser (localStorage). Live cross-device sync,
  presence and AI work when the page runs with those services available.
