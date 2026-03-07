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

## 📜 License

This project is licensed under the **Apache-2.0 License**. See the source files for more details.

---
*Built for the next generation of software engineers.*
