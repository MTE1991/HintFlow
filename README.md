# HintFlow 🚀

**HintFlow** is an AI-powered Socratic coding tutor designed specifically for computer science students and beginners. Instead of providing immediate solutions, HintFlow guides users through programming problems using progressive hints, helping them develop problem-solving skills and a deeper understanding of coding logic.

![HintFlow UI](https://picsum.photos/seed/hintflow/1200/600)

## ✨ Features

- **Socratic Tutoring**: Provides high-level overviews and conceptual nudges before showing code.
- **Progressive Hints**: Reveal 3-4 hints one by one, from conceptual logic to implementation details.
- **Python-Focused**: All solutions and hints are tailored for Python, the ideal language for beginners.
- **Code Editor View**: Full solutions are displayed in a professional, multi-line code editor with syntax highlighting and line numbers.
- **Relevance Filtering**: Intelligently identifies and filters out non-programming prompts to stay focused on coding education.
- **Terminal Aesthetic**: A clean, dark-themed UI inspired by classic developer environments.
- **No Spoilers**: Solutions are hidden behind a "Reveal" button to prevent accidental spoilers.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **AI Engine**: Google Gemini 3.1 Pro (via `@google/genai`)
- **Styling**: Tailwind CSS 4
- **Animations**: Motion
- **Icons**: Lucide React
- **Syntax Highlighting**: React Syntax Highlighter (Prism)
- **Markdown**: React Markdown

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v9 or higher)
- A Google Gemini API Key (Get one for free at [Google AI Studio](https://aistudio.google.com/))

### Installation

1. **Clone or download** the repository to your local machine.
2. **Navigate** to the project directory:
   ```bash
   cd HintFlow
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```

### Configuration

1. Create a `.env` file in the root directory:
   ```bash
   touch .env
   ```
2. Add your Gemini API key to the `.env` file:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

### Running the App

Start the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

## 📖 How to Use

1. **Enter a Problem**: Paste a coding problem statement (e.g., "Write a function to check if a number is prime").
   - *Note: HintFlow will filter out prompts that are not related to programming.*
2. **Read the Overview**: HintFlow will provide a conceptual explanation of the problem.
3. **Reveal Hints**: Click "Reveal Next Hint" to get progressive clues about the logic and syntax.
4. **Solve It**: Try to write the code yourself based on the hints!
5. **Check the Solution**: If you're stuck or want to compare your work, click "Reveal Full Solution" to see the Python implementation and a detailed explanation.

## 🧠 Under the Hood

### Socratic Prompting Strategy
HintFlow uses a specialized **System Instruction** to guide the Gemini 3.1 Pro model. Instead of a standard chat interface, the model is instructed to act as a "Socratic Tutor." It follows a strict multi-step reasoning process:
1. **Relevance Check**: The model first evaluates if the input is a programming problem.
2. **Conceptual Overview**: It identifies the core CS concepts involved (e.g., recursion, data structures).
3. **Hint Generation**: It creates 3-4 hints that progressively move from abstract logic to specific implementation details.
4. **Solution Guarding**: It provides a full, well-formatted Python solution and a deep-dive explanation.

### Structured Data Flow
To ensure the UI remains consistent, HintFlow leverages **JSON Schema** enforcement. The Gemini API returns a structured object:
```json
{
  "isRelevant": boolean,
  "overview": "string",
  "hints": ["string", "string", "string"],
  "solution": "string",
  "explanation": "string"
}
```
This allows the React frontend to parse the response reliably and manage the state of hidden/revealed content.

### Progressive Revelation Logic
The frontend manages the "Hint State" using React hooks. Hints are stored in an array but only rendered based on a `visibleHintsCount` state. This ensures that users aren't overwhelmed and are encouraged to think through each step before moving to the next.

### Professional Code Rendering
For the solution view, HintFlow integrates `react-syntax-highlighter` with the **Prism** engine. It uses the `vscDarkPlus` theme and custom CSS to simulate a real-world IDE experience, complete with line numbers and optimized line heights.

## 📜 License

This project is licensed under the **Apache-2.0 License**. See the source files for more details.

---
*Built for the next generation of software engineers.*
