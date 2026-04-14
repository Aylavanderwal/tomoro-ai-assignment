# AeroData — AI-Assisted Data Operations Demo

An interactive prototype demonstrating how an AI agent can assist data operations teams in cleansing and classifying large passenger datasets — pausing for human decisions only when confidence is insufficient.

Built with React 18, TypeScript, Vite, and Tailwind CSS v4.

---

## Quick start

**Requirements:** Node.js 18 or higher

```bash
# 1. Clone the repo
git clone https://github.com/Aylavanderwal/tomoro-ai-assignment.git
cd tomoro-ai-assignment

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.
> If port 5173 is taken, Vite will use 5174 — check the terminal output for the exact URL.

---

## Demo walkthrough

The demo simulates an AI agent processing 1.2 million passenger records. There is a guided tour built in — on first load you'll be asked if you want narration at each step.

### Flow

| Step | What to do |
|------|-----------|
| **1. Proposed** | Click **Passenger Master** in the dataset list to expand the agent's proposed plan |
| **2. Review plan** | Inspect what will be cleansed automatically, classified, and what may pause for your input |
| **3. Adjust rules** | Click **Adjust rules** to set the agent's confidence threshold |
| **4. Run** | Click **Run agent** to start processing |
| **5. Activity log** | Watch the log populate in real time as rules are applied |
| **6. Block** | The agent will pause when it hits an ambiguous pattern — a notification appears bottom-right |
| **7. Decide** | Review the decision card, expand sub-patterns, then Approve or Skip |
| **8. Resume** | Agent resumes automatically after each decision |
| **9. Stop** | The **Stop agent** button is always available to halt and resume from checkpoint |

### Dev controls

A **Test controls** panel appears bottom-right while the agent is running. Use it to manually trigger blocks and explore each state without waiting for the timer.

---

## Project structure

```
src/
  app/
    App.tsx        # All UI and demo logic (single-file prototype)
  styles/
    index.css      # Entry stylesheet
    tailwind.css   # Tailwind v4 config
    theme.css      # CSS variables / design tokens
  main.tsx         # React entry point
index.html
```

---

## Tech stack

- **React 18** + **TypeScript**
- **Vite 6**
- **Tailwind CSS v4**
- **Lucide React** — icons
- **Radix UI** — accessible primitives
