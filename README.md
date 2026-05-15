# HintFlow 🚀

**HintFlow** is an AI-powered Socratic coding tutor designed specifically for computer science students and research analysis. Instead of providing immediate solutions, HintFlow guides users through programming problems using progressive scaffolding, high-depth technical analysis, and data-rich interactions.

![HintFlow UI](https://picsum.photos/seed/hintflow/1200/600)

## ✨ Features

- **Unix Terminal Aesthetic**: A professionally crafted, high-contrast UI inspired by classic shell environments and `tmux` multiplexers, using **Fira Code** for all typography.
- **Selective Language Generation**: Users select a target language (Python, C++, or C) before starting, reducing token overhead by ~65% and drastically improving performance.
- **Phase-Based Retrieval (Lazy Loading)**: Implements a dual-phase execution model. Hints are generated instantly (Phase 1), while full solutions and deep-dives are fetched only upon request (Phase 2).
- **Data-Rich Interactions (Research Mode)**: Automatically extracts metadata such as `topic_tags`, `difficulty_score`, and `technical_depth_score` for quantifiable learning analysis.
- **Socratic "Check for Understanding"**: Generates dynamic `reflective_questions` to force conceptual engagement before code disclosure.
- **Adaptive Scaffolding**: Analyzes user-provided code for specific logic errors and tailors the initial hint sequence to address those unique mistakes.
- **Expert Post-Mortem**: Once solved, HintFlow transitions into **Expert Implementation Mode**, providing high-depth technical analysis of memory management, performance trade-offs, and first-principles mechanics.
- **Complexity Analysis Card**: Dedicated UI for mandatory $O(n)$ Time and Space complexity metrics.
- **Common Pitfalls**: Identifies frequent student bugs and edge cases specific to the problem.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **AI Engine**: Google Gemini 3.1 Pro (via `@google/genai`)
- **Styling**: Tailwind CSS 4
- **Animations**: Motion
- **Icons**: Lucide React
- **Syntax Highlighting**: React Syntax Highlighter (Prism)
- **Math Support**: Full LaTeX support for algorithmic expressions using KaTeX.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v9 or higher)
- A Google Gemini API Key (Get one at [Google AI Studio](https://aistudio.google.com/))

### Installation

1. **Clone or download** the repository.
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment**: Add your `GEMINI_API_KEY` to your environment variables or a `.env` file.

### Running the App

```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

## 🧠 Under the Hood

### System Architecture
```mermaid
graph LR
    User([User]) --> Terminal[Terminal Shell]
    Terminal --> State[Session Manager]
    State <--> AI[Neural Engine]
    
    subgraph Execution [Phase-Based Core]
        AI --> HINTS[Phase 1: Scaffolding]
        AI --> SOLUTIONS[Phase 2: Deep Dive]
    end
    
    Execution --> Rendering[Dynamic Display Engine]
    Rendering --> Terminal
```

### Instructional Modes
HintFlow utilizes a specialized state-machine for pedagogical delivery:

1. **HINT_MODE (Phase 1)**: Focuses on "Desirable Difficulty." It provides conceptual analogies, pseudocode strategies, and a "reflective question" to ensure the student builds a mental map before viewing code.
2. **SOLUTION_MODE (Phase 2)**: Triggered on-demand. Generates an idiomatic, production-grade implementation with trade-off analysis (e.g., Iterative vs Recursive) and common pitfalls.
3. **FOLLOWUP_MODE (Post-Mortem)**: Acts as an **Expert Implementation Consultant**. It answers "under the hood" questions regarding stack frames, memory management, and real-world engineering scenarios.

### Research & Data Quantification
To support technical publications and quantifiable analysis, every AI response includes research metrics:
- **`topic_tags`**: For domain difficulty analysis.
- **`difficulty_score` (1-10)**: Quantifies the cognitive load of a given problem.
- **`technical_depth_score` (1-5)**: Measures the complexity of expert follow-up responses.

### Structured Response Schema
HintFlow leverages **STRICT JSON** enforcement to ensure the React frontend remains robust. The schema evolves based on the active phase:

**Phase 1 Response:**
```json
{
  "isRelevant": boolean,
  "topic_tags": ["Recursion", "Arrays"],
  "difficulty_score": 7,
  "overview": "Big Idea explanation...",
  "hints": ["Hint 1", "Hint 2"],
  "reflective_question": "Socratic CFU..."
}
```

**Phase 2 Response:**
```json
{
  "solution": "Full code implementation...",
  "language": "python",
  "complexity": { "time": "O(n log n)", "space": "O(n)" },
  "explanation": "Deep dive text...",
  "pitfalls": ["Common bug 1", "Common bug 2"]
}
```

**Follow-up Response:**
```json
{
  "overview": "Direct expert answer...",
  "technical_depth_score": 4,
  "hints": []
}
```

## 📜 License

This project is licensed under the **Apache-2.0 License**.

---
*Built for the next generation of software engineers and researchers.*
