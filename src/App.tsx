/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Terminal, RefreshCcw, Copy, Check, X, 
  MessageSquare, Download, HelpCircle, HardDrive,
  Sun, Moon, Minus, Plus
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { HintFlowResponse, Tab } from './types';
import { generateJson, coerceHintFlow } from './lib/llm';
import { WelcomeScreen } from './components/WelcomeScreen';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Code snippets use Atom One Dark on the dark canvas and Atom One Light on paper. */
const SYNTAX_THEMES: Record<Theme, typeof oneDark> = {
  dark: oneDark,
  light: oneLight,
};

/** Comment-grey line numbers that stay legible on each theme's own background. */
const LINE_NUMBER_COLORS: Record<Theme, string> = {
  dark: '#5c6370',
  light: '#8b8f97',
};

const createMarkdownComponents = (theme: Theme) => ({
  code({ inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <div className="my-3 rounded-lg overflow-hidden border border-zinc-800">
        <SyntaxHighlighter
          language={match[1]}
          style={SYNTAX_THEMES[theme]}
          PreTag="div"
          customStyle={{ 
            margin: 0, 
            padding: '1rem',
            fontSize: '11px',
            lineHeight: '1.5',
            fontFamily: '"Fira Code", monospace'
          }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code className={cn("bg-zinc-800 px-1.5 py-0.5 rounded text-[calc(11px*var(--fs))] font-mono text-amber-500/80", className)} {...props}>
        {children}
      </code>
    );
  },
});

const HINTS_INSTRUCTION = `You are **HintFlow**, a specialized Socratic tutor. 
Your goal is to scaffold learning by minimizing "Cognitive Load" while maximizing "Desirable Difficulty."

### 🛡️ Core Rules
- **Method**: HINT_MODE. Focus on "Guided Discovery."
- **NO FULL SOLUTIONS**: Do not provide the final implementation.
- **Adaptive Scaffolding**: If the user provided code, analyze their specific logic error and tailor Hint 1-2 to that specific mistake.

### 🏗️ Content Generation
1. **Overview**: Explain the "Big Idea" (e.g., "Divide and Conquer").
2. **Progressive Hints**: 
   - **Level 1**: Conceptual analogy.
   - **Level 2**: Algorithmic strategy (Pseudocode logic).
   - **Level 3**: Programming concepts or data structure features to use.
   - **Level 4**: Minimal code snippet (3-5 lines) of the "bottleneck" logic only.
     - **MUST be formatted with proper multiple lines and indentation.**
     - **STRICTLY FORBIDDEN: Semicolons used to merge multiple lines or construct single-line blocks. Spacing must be correct.**
3. **Reflective Question**: A single question that asks the user to predict what happens next or why a certain choice is made.

### 📤 Response Format (STRICT JSON)
{
  "isRelevant": boolean,
  "topic_tags": ["Recursion", "Arrays", etc.],
  "difficulty_score": 1-10,
  "overview": "string",
  "hints": ["string", "string", "string"],
  "reflective_question": "string" 
}`;

const SOLUTION_INSTRUCTION = `You are the **HintFlow Expert Implementation Consultant**.
The user is ready for the "Golden Path" solution.

### 🏗️ Content Generation Guidelines
1. **Language Selection Rules**:
   - **IF THE USER EXPLICITLY ASKED FOR SPECIFIC PROGRAMMING LANGUAGE(S)** in their prompt or conversation (e.g. "in Java", "using Rust", "in Go", "in Python", "in C++", "in TypeScript", etc.): Provide full, production-grade, idiomatic solution(s) in the \`solutions\` array ONLY for the requested language(s). Set the \`language\` property of each solution object to the lowercase language name (e.g., "java", "rust", "go", "python", "cpp", "c", "javascript", "typescript", etc.).
   - **IF NO SPECIFIC LANGUAGE WAS EXPLICITLY REQUESTED BY THE USER**: You MUST generate full, production-grade, idiomatic solutions in ALL THREE default languages: C, C++, and Python in the \`solutions\` array (with language values "c", "cpp", "python").

2. **Code Formatting Requirements**:
   - **MUST be beautifully formatted with physical newlines (escaped as \\n in JSON) and proper nesting indentation (4 spaces per nesting level for Python).**
   - **STRICT DIRECTIVE: NEVER compress code logic or multiple statements onto a single line using semicolons (\`;\`). Every statement must be on its own line. Semicolons should never be used as a replacement for newlines.**
   - Do NOT abbreviate code. Ensure variables have clear, descriptive names.

3. **Deep Dive & Complexity**:
   - Explain the logic clearly.
   - **Complexity**: Mandatory Time/Space complexity analysis.
   - **Trade-offs**: Briefly mention one alternative way to solve this (e.g., Iterative vs Recursive) and why this version was chosen.

4. **Common Pitfalls**: Mention 2 common bugs students make with this specific problem.

### 📤 Response Format (STRICT JSON)
{
  "solutions": [
    {
      "language": "python",
      "code": "string"
    },
    {
      "language": "cpp",
      "code": "string"
    },
    {
      "language": "c",
      "code": "string"
    }
  ],
  "complexity": { "time": "O(?)", "space": "O(?)" },
  "explanation": "string",
  "pitfalls": ["string", "string"],
  "resources": {
    "books": [{ "title": "string", "author": "string" }],
    "websites": [{ "name": "string", "url": "string" }]
  }
}`;

const FOLLOWUP_INSTRUCTION = `You are the **HintFlow Expert Implementation Consultant**. 
The user has the solution and is now performing a "Post-Mortem" analysis.

### 🏗️ Content Generation Guidelines
- **Academic Depth**: Use first-principles reasoning to explain "under the hood" mechanics (e.g., Memory management, Stack frames, Compiler optimizations).
- **Practicality**: Connect the user's question to real-world engineering scenarios.
- **Format**: Use Markdown for code snippets and bold text for key terms.

### 📤 Response Format
{
  "overview": "multi-paragraph string",
  "technical_depth_score": 1-5,
  "hints": []
}`;

const SESSIONS_STORAGE_KEY = 'hintflow_sessions_v1';
const ACTIVE_TAB_STORAGE_KEY = 'hintflow_active_tab_v1';
const SHOW_WELCOME_STORAGE_KEY = 'hintflow_show_welcome_v1';
const THEME_STORAGE_KEY = 'hintflow_theme_v1';
const FONT_SCALE_STORAGE_KEY = 'hintflow_font_scale_v1';

type Theme = 'dark' | 'light';

/** 100% is the design size; the rest scale every text token in the app. */
const FONT_SCALES = [0.875, 1, 1.15, 1.3];

const getInitialTabs = (): Tab[] => {
  try {
    const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Failed to load sessions from local storage", err);
  }
  return [{
    id: 'initial',
    title: 'New Session',
    messages: [],
    activeSession: null,
    visibleHintsCount: 0,
    solved: false
  }];
};

const getInitialActiveTabId = (initialTabs: Tab[]): string => {
  try {
    const saved = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    if (saved && initialTabs.some(t => t.id === saved)) {
      return saved;
    }
  } catch (err) {
    console.error("Failed to load active tab from local storage", err);
  }
  return initialTabs[0]?.id || 'initial';
};

const getInitialShowWelcome = (): boolean => {
  try {
    const saved = localStorage.getItem(SHOW_WELCOME_STORAGE_KEY);
    if (saved !== null) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.error("Failed to load welcome preference from local storage", err);
  }
  return true;
};

const getInitialTheme = (): Theme => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch (err) {
    console.error("Failed to load theme from local storage", err);
  }
  return 'dark';
};

const getInitialFontScale = (): number => {
  try {
    const saved = Number(localStorage.getItem(FONT_SCALE_STORAGE_KEY));
    if (FONT_SCALES.includes(saved)) {
      return saved;
    }
  } catch (err) {
    console.error("Failed to load font size from local storage", err);
  }
  return 1;
};

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>(getInitialTabs);
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const initialTabs = getInitialTabs();
    return getInitialActiveTabId(initialTabs);
  });

  const [showWelcomeOnStart, setShowWelcomeOnStart] = useState<boolean>(getInitialShowWelcome);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState<boolean>(showWelcomeOnStart);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [fontScale, setFontScale] = useState<number>(getInitialFontScale);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0] || {
    id: 'initial',
    title: 'New Session',
    messages: [],
    activeSession: null,
    visibleHintsCount: 0,
    solved: false
  };
  const { messages, activeSession, visibleHintsCount, solved } = activeTab;

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSolutionLoading, setIsSolutionLoading] = useState(false);
  const [modalData, setModalData] = useState<HintFlowResponse | null>(null);
  const [activeSolutionLangIdx, setActiveSolutionLangIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const markdownComponents = useMemo(() => createMarkdownComponents(theme), [theme]);

  const fontScaleIndex = FONT_SCALES.indexOf(fontScale);
  const canDecreaseFont = fontScaleIndex > 0;
  const canIncreaseFont = fontScaleIndex < FONT_SCALES.length - 1;

  const changeFontScale = (delta: number) => {
    const nextIndex = Math.min(FONT_SCALES.length - 1, Math.max(0, fontScaleIndex + delta));
    setFontScale(FONT_SCALES[nextIndex]);
  };

  // Persistence Effects
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(tabs));
    } catch (err) {
      console.error("Failed to save sessions to local storage", err);
    }
  }, [tabs]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTabId);
    } catch (err) {
      console.error("Failed to save active tab to local storage", err);
    }
  }, [activeTabId]);

  useEffect(() => {
    try {
      localStorage.setItem(SHOW_WELCOME_STORAGE_KEY, JSON.stringify(showWelcomeOnStart));
    } catch (err) {
      console.error("Failed to save welcome preference to local storage", err);
    }
  }, [showWelcomeOnStart]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (err) {
      console.error("Failed to save theme to local storage", err);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--fs', String(fontScale));
    try {
      localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(fontScale));
    } catch (err) {
      console.error("Failed to save font size to local storage", err);
    }
  }, [fontScale]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [tabs, activeTabId, activeTab?.visibleHintsCount, modalData]);

  const updateActiveTab = (updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  };

  const createNewTab = (initialPrompt?: string) => {
    const id = Math.random().toString(36).substring(7);
    const newTab: Tab = {
      id,
      title: initialPrompt ? (initialPrompt.length > 20 ? initialPrompt.substring(0, 20) + '...' : initialPrompt) : 'New Session',
      messages: [],
      activeSession: null,
      visibleHintsCount: 0,
      solved: false
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(id);
    return id;
  };

  const processUserPrompt = async (userMessageText: string, targetTabId?: string) => {
    const userMessage = userMessageText.trim();
    if (!userMessage || isLoading) return;

    let currentTabId = targetTabId || activeTabId;
    const currentTab = tabs.find(t => t.id === currentTabId) || activeTab;
    let isFollowUp = currentTab.solved;

    if (!currentTab.solved && currentTab.messages.length === 0) {
      setTabs(prev => prev.map(t => t.id === currentTabId ? { 
        ...t, 
        title: userMessage.length > 20 ? userMessage.substring(0, 20) + '...' : userMessage,
        messages: [{ role: 'user', content: userMessage }]
      } : t));
    } else if (!currentTab.solved) {
      currentTabId = createNewTab(userMessage);
      setTabs(prev => prev.map(t => t.id === currentTabId ? { 
        ...t, 
        messages: [{ role: 'user', content: userMessage }] 
      } : t));
    } else {
      setTabs(prev => prev.map(t => t.id === currentTabId ? { 
        ...t, 
        messages: [...t.messages, { role: 'user', content: userMessage, isFollowUp: true }]
      } : t));
    }

    setIsLoading(true);

    try {
      const customInstruction = isFollowUp 
        ? FOLLOWUP_INSTRUCTION
        : HINTS_INSTRUCTION;

      const data = coerceHintFlow(
        await generateJson<HintFlowResponse>({
          system: customInstruction,
          user: userMessage,
          reasoningEffort: isFollowUp ? 'high' : 'low',
        }),
      );
      
      setTabs(prev => prev.map(t => {
        if (t.id === currentTabId) {
          return {
            ...t,
            activeSession: isFollowUp ? t.activeSession : data,
            messages: [...t.messages, { 
              role: 'assistant', 
              content: data.overview,
              data: data,
              isFollowUp
            }]
          };
        }
        return t;
      }));
    } catch (error) {
      console.error("Error generating hints:", error);
      setTabs(prev => prev.map(t => {
        if (t.id === currentTabId) {
          return {
            ...t,
            messages: [...t.messages, { 
              role: 'assistant', 
              content: "I encountered an error while processing your request. Please try again." 
            }]
          };
        }
        return t;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const msg = input.trim();
    setInput('');
    await processUserPrompt(msg);
  };

  const handleWelcomeStart = (samplePrompt?: string) => {
    setIsWelcomeModalOpen(false);
    if (samplePrompt) {
      processUserPrompt(samplePrompt);
    }
  };

  const revealNextHint = () => {
    if (activeSession && visibleHintsCount < activeSession.hints.length) {
      updateActiveTab({ visibleHintsCount: visibleHintsCount + 1 });
    }
  };

  const markAsSolved = async (data: HintFlowResponse) => {
    if (data.solutions && data.solutions.length > 0) {
      setModalData(data);
      setActiveSolutionLangIdx(0);
      updateActiveTab({ solved: true });
      return;
    }

    setIsSolutionLoading(true);
    try {
      const problemStatement = activeTab.messages.length > 0 ? activeTab.messages[0].content : '';
      
      const solutionData = await generateJson<Partial<HintFlowResponse>>({
        system: SOLUTION_INSTRUCTION,
        user: `Provide the full solution for this coding problem: "${problemStatement}". If I explicitly requested a specific programming language in my prompt, provide only that requested language in the solutions array. Otherwise, default to providing solutions for C, C++, and Python in the solutions array.`,
        thinking: 'disabled',
      });

      const fullResponse: HintFlowResponse = coerceHintFlow({
        ...data,
        ...solutionData
      });

      setTabs(prev => prev.map(t => t.id === activeTabId ? {
        ...t,
        activeSession: fullResponse,
        solved: true,
        messages: t.messages.map(m => m.data === data ? { ...m, data: fullResponse } : m)
      } : t));
      
      setModalData(fullResponse);
      setActiveSolutionLangIdx(0);
    } catch (error) {
      console.error("Error generating solution:", error);
    } finally {
      setIsSolutionLoading(false);
    }
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      reset();
      return;
    }
    
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const reset = () => {
    const freshTab: Tab = {
      id: 'initial_' + Date.now().toString(36),
      title: 'New Session',
      messages: [],
      activeSession: null,
      visibleHintsCount: 0,
      solved: false
    };
    setTabs([freshTab]);
    setActiveTabId(freshTab.id);
    setModalData(null);
    setActiveSolutionLangIdx(0);
    setInput('');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadResearchLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tabs, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `hintflow_research_logs_${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const cleanCode = (code: string) => {
    if (!code) return '';
    return code
      .replace(/\\n/g, '\n')
      .trim()
      .replace(/\n{3,}/g, '\n\n');
  };

  // Derive active solutions list for modal
  const modalSolutions = modalData?.solutions && modalData.solutions.length > 0
    ? modalData.solutions
    : modalData?.solution
      ? [{ language: modalData.language || 'code', code: modalData.solution }]
      : [];

  const activeSolutionCodeObj = modalSolutions[activeSolutionLangIdx] || modalSolutions[0];

  return (
    <div className="h-[100dvh] w-full flex items-center justify-center p-0 md:p-4 lg:p-8 bg-onyx overflow-hidden font-mono antialiased">
      {/* Animated Welcome Screen Modal */}
      <AnimatePresence>
        {isWelcomeModalOpen && (
          <WelcomeScreen
            onStart={handleWelcomeStart}
            onClose={() => setIsWelcomeModalOpen(false)}
            showOnStart={showWelcomeOnStart}
            setShowOnStart={setShowWelcomeOnStart}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          />
        )}
      </AnimatePresence>

      {/* Terminal Window */}
      <div className="w-full h-full max-w-6xl md:h-[90vh] flex flex-col bg-surface md:border md:border-line shadow-2xl relative overflow-hidden md:rounded-lg">
        
        {/* Title Bar */}
        <div className="flex items-center justify-between px-3 py-2 md:px-4 bg-titlebar border-b border-line shrink-0">
          <div className="flex items-center gap-3 md:gap-6 overflow-hidden">
            <div className="hidden md:flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
            </div>
            <div className="flex items-center gap-2 text-[calc(10px*var(--fs))] md:text-xs font-bold text-zinc-400 truncate">
              <Terminal className="w-3 md:w-3.5 h-3 md:h-3.5 shrink-0 text-accent" />
              <span className="truncate">hintflow — user — 80x24</span>
              <span className="hidden lg:inline-flex items-center gap-1 text-[calc(9px*var(--fs))] text-accent/80 px-1.5 py-0.2 rounded border border-accent/20 font-mono ml-2">
                <HardDrive className="w-2.5 h-2.5" /> LOCAL_CACHE_ONLINE
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="text-zinc-400 hover:text-accent transition-colors p-1"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
              <div className="flex items-center gap-0.5 pl-1.5 ml-0.5 border-l border-line">
                <button
                  onClick={() => changeFontScale(-1)}
                  disabled={!canDecreaseFont}
                  className="text-zinc-400 hover:text-accent transition-colors p-1 disabled:opacity-30"
                  title="Smaller text"
                  aria-label="Decrease text size"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-[calc(8px*var(--fs))] text-zinc-500 font-mono tabular-nums w-7 text-center select-none">
                  {Math.round(fontScale * 100)}%
                </span>
                <button
                  onClick={() => changeFontScale(1)}
                  disabled={!canIncreaseFont}
                  className="text-zinc-400 hover:text-accent transition-colors p-1 disabled:opacity-30"
                  title="Larger text"
                  aria-label="Increase text size"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
             <button 
                onClick={() => setIsWelcomeModalOpen(true)}
                className="text-zinc-400 hover:text-accent transition-colors p-1"
                title="Open Welcome Screen & Guide"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
             <button 
                onClick={downloadResearchLogs}
                className="text-zinc-400 hover:text-accent transition-colors p-1"
                title="Download Research Logs"
                disabled={messages.length === 0}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
             <button 
                onClick={reset}
                className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                title="Reset Terminal / Clear All Tabs"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
              </button>
          </div>
        </div>

        {/* Tab Bar (Tmux style) */}
        <div className="flex items-center bg-chrome px-2 py-1 shrink-0 gap-1 overflow-x-auto no-scrollbar">
           {tabs.map((tab, idx) => (
            <div
              key={tab.id}
              className={cn(
                "group/tab flex items-center gap-2 px-3 py-1 text-[calc(10px*var(--fs))] font-bold cursor-pointer transition-colors border-r border-line/30",
                activeTabId === tab.id 
                  ? "bg-accent text-on-accent" 
                  : "text-accent/50 hover:bg-chrome-hover"
              )}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span>{idx}: {tab.title}</span>
              {tab.solved && <span className="text-[calc(8px*var(--fs))]">●</span>}
              <button
                onClick={(e) => closeTab(e, tab.id)}
                className={cn(
                  "opacity-0 group-hover/tab:opacity-100 hover:text-red-500 transition-opacity",
                  activeTabId === tab.id && "opacity-60 text-on-accent hover:text-red-900"
                )}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          <button 
            onClick={() => createNewTab()}
            className="px-3 py-1 text-[calc(10px*var(--fs))] font-bold text-accent/30 hover:text-accent transition-colors"
            title="Create New Session Tab"
          >
            [+]
          </button>
        </div>

        {/* Terminal Content */}
        <main className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 relative">
          {/* Scrollable Output */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto space-y-6 terminal-scroll md:pr-4 touch-auto"
          >
            {messages.length === 0 && (
              <div className="space-y-5 text-xs md:text-sm">
                <div className="text-accent">
                  <p>HintFlow OS v1.3.0 (tty1)</p>
                  <p>user@hintflow — ready</p>
                </div>
                <div className="space-y-3 max-w-xl">
                  <p className="text-zinc-400 leading-relaxed">
                    A Socratic tutor for coding problems. You get hints first, and the full solution only when you ask for it.
                  </p>
                  <ol className="space-y-1.5 text-zinc-400">
                    <li><span className="text-accent font-bold">1.</span> Paste a problem — or your own attempt.</li>
                    <li><span className="text-accent font-bold">2.</span> Reveal hints one at a time.</li>
                    <li><span className="text-accent font-bold">3.</span> Unlock the solution when you're ready.</li>
                  </ol>
                  <p className="text-zinc-500 text-[calc(11px*var(--fs))]">
                    Solutions come in C, C++ and Python. Say "in Java" (or any language) to get something else.
                  </p>
                  
                  <p className="text-zinc-600 text-[calc(11px*var(--fs))]">
                    Type below and press Enter to start. Your sessions are saved in this browser.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className="space-y-3">
                {/* Prompt Line */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[calc(10px*var(--fs))] md:text-xs">
                    <span className={cn(
                      "font-bold shrink-0",
                      msg.role === 'user' ? "text-accent" : "text-amber-500"
                    )}>
                      [{msg.role === 'user' ? 'student' : 'mentor'}@hintflow]$
                    </span>
                    <span className="text-zinc-600 text-[calc(9px*var(--fs))] md:text-[calc(10px*var(--fs))] uppercase font-bold tracking-tighter shrink-0">
                      {msg.isFollowUp ? "# follow-up" : "# core"}
                    </span>
                    {msg.data?.topic_tags && (
                      <div className="flex gap-1 overflow-hidden">
                        {msg.data.topic_tags.map((tag, tIdx) => (
                          <span key={tIdx} className="text-[calc(8px*var(--fs))] md:text-[calc(9px*var(--fs))] px-1 bg-zinc-800 text-zinc-500 rounded border border-zinc-700">
                             {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.data?.difficulty_score && (
                      <span className="text-[calc(8px*var(--fs))] md:text-[calc(9px*var(--fs))] text-accent/40 px-1 border border-accent/20 rounded font-mono">
                        DIFF: {msg.data.difficulty_score}/10
                      </span>
                    )}
                    {msg.data?.technical_depth_score && (
                      <span className="text-[calc(8px*var(--fs))] md:text-[calc(9px*var(--fs))] text-amber-500/40 px-1 border border-amber-500/20 rounded font-mono">
                        DEPTH: {msg.data.technical_depth_score}/5
                      </span>
                    )}
                  </div>
                </div>

                {/* Message Content */}
                <div className={cn(
                   "pl-3 md:pl-6 border-l border-zinc-800/50 py-1",
                   msg.role === 'assistant' && "text-zinc-200"
                )}>
                  <div className="prose prose-invert prose-xs max-w-none prose-p:leading-relaxed prose-code:text-accent prose-code:bg-transparent prose-code:p-0 text-[calc(12px*var(--fs))] md:text-sm">
                    <Markdown 
                      remarkPlugins={[remarkMath]} 
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {msg.content}
                    </Markdown>
                  </div>
                </div>

                {/* Hints / Solution UI */}
                {msg.data && msg.data.isRelevant && !msg.isFollowUp && (
                  <div className="pl-3 md:pl-6 mt-4 space-y-6">
                    <div className="flex items-center gap-2 text-[calc(9px*var(--fs))] md:text-[calc(10px*var(--fs))] font-bold text-accent/40 uppercase tracking-widest border-t border-zinc-900 pt-4">
                       Hints
                    </div>
                    
                    <div className="space-y-4">
                      {msg.data.hints.slice(0, visibleHintsCount).map((hint, hIdx) => (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          key={hIdx}
                          className="flex gap-2 md:gap-4 items-start"
                        >
                          <span className="text-accent/30 shrink-0 select-none text-[calc(10px*var(--fs))] md:text-sm">H0{hIdx + 1}:</span>
                          <div className="flex-1 prose prose-invert prose-xs leading-relaxed text-zinc-400 text-[calc(11px*var(--fs))] md:text-sm">
                            <Markdown 
                              remarkPlugins={[remarkMath]} 
                              rehypePlugins={[rehypeKatex]}
                              components={markdownComponents}
                            >
                              {hint}
                            </Markdown>
                          </div>
                        </motion.div>
                      ))}

                      {visibleHintsCount > 0 && msg.data.reflective_question && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 p-3 md:p-4 bg-accent/5 border border-accent/10 rounded-sm"
                        >
                          <div className="text-[calc(9px*var(--fs))] md:text-[calc(10px*var(--fs))] font-bold text-accent uppercase tracking-widest flex items-center gap-2 mb-2">
                            <MessageSquare className="w-3 h-3" /> Think about this
                          </div>
                          <p className="text-[calc(11px*var(--fs))] md:text-sm text-accent/80 leading-relaxed italic">
                            {msg.data.reflective_question}
                          </p>
                        </motion.div>
                      )}
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 md:gap-6">
                      {visibleHintsCount < msg.data.hints.length && (
                        <button
                          onClick={revealNextHint}
                          className="text-[calc(10px*var(--fs))] md:text-[calc(11px*var(--fs))] font-bold text-accent hover:underline uppercase tracking-widest text-left"
                        >
                          [ Reveal hint ({visibleHintsCount} of {msg.data.hints.length}) ]
                        </button>
                      )}

                      {visibleHintsCount === msg.data.hints.length && (
                        <button
                          onClick={() => markAsSolved(msg.data!)}
                          disabled={isSolutionLoading}
                          className={cn(
                            "text-[calc(10px*var(--fs))] md:text-[calc(11px*var(--fs))] font-bold text-amber-500 hover:underline uppercase tracking-widest text-left",
                            isSolutionLoading && "opacity-50 cursor-wait"
                          )}
                        >
                          {isSolutionLoading ? "[ Compiling… ]" : "[ Show solution ]"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-4 text-accent/60 text-[calc(10px*var(--fs))] font-bold animate-pulse pl-2">
                <span>_</span>
                <span>Thinking…</span>
              </div>
            )}
          </div>

          {/* Prompt Area */}
          <div className="mt-auto pt-4 md:pt-6 border-t border-line/50">
             <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
               {solved ? (
                <div className="text-[calc(10px*var(--fs))] text-amber-500/70 italic">
                  Solution unlocked — ask any follow-up question.
                </div>
               ) : (
                <div className="text-[calc(10px*var(--fs))] text-accent/50 font-mono">
                  Enter to send · Shift+Enter for a new line
                </div>
               )}
             </div>

            <form 
              onSubmit={handleSubmit}
              className="flex flex-col md:flex-row md:items-start gap-2 group"
            >
              <div className="text-accent shrink-0 md:py-1 text-[calc(10px*var(--fs))] md:text-sm font-bold opacity-60 md:opacity-100 flex items-center gap-2">
                 <span>student@hintflow %</span>
              </div>
              <textarea
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={solved ? "Ask a follow-up…" : "Paste a problem or your code…"}
                className="flex-1 bg-transparent border-none text-accent placeholder:text-accent/20 focus:outline-none resize-none overflow-hidden max-h-40 py-1 text-[calc(13px*var(--fs))] md:text-sm"
                disabled={isLoading}
                autoFocus
              />
            </form>
          </div>
        </main>
      </div>

      {/* Solution Modal (Terminal Styled) */}
      <AnimatePresence>
        {modalData && (
          <div className="fixed inset-0 h-[100dvh] w-full z-50 flex items-center justify-center p-0 md:p-8 lg:p-16 bg-onyx/95 md:bg-onyx/90 backdrop-blur-sm uppercase-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full h-full max-w-6xl md:rounded-lg bg-surface border border-line/50 md:border-line flex flex-col shadow-2xl relative overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-3 md:px-4 py-2 bg-chrome border-b border-line shrink-0">
                 <div className="flex items-center gap-2 md:gap-3">
                    <span className="text-accent font-bold text-[calc(10px*var(--fs))] md:text-xs tracking-widest italic truncate">_VIEW: SOLUTION.LOG</span>
                 </div>
                 <button
                  onClick={() => setModalData(null)}
                  className="text-zinc-600 hover:text-accent transition-colors font-bold text-[calc(10px*var(--fs))] md:text-xs p-1"
                >
                  [ CLOSE ]
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 md:space-y-12 terminal-scroll">
                <div className="bg-onyx/40 border border-line-soft rounded overflow-hidden">
                  {/* Editor Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between px-3 py-2 bg-chrome border-b border-line-soft gap-3">
                    <div className="flex items-center gap-2 overflow-x-auto">
                       <span className="text-[calc(9px*var(--fs))] md:text-[calc(10px*var(--fs))] text-zinc-500 font-bold uppercase tracking-widest shrink-0 mr-2">
                        LANG:
                      </span>
                      {modalSolutions.map((sol, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveSolutionLangIdx(idx)}
                          className={cn(
                            "px-2.5 py-0.5 text-[calc(9px*var(--fs))] font-bold uppercase tracking-widest transition-all border rounded-sm shrink-0",
                            activeSolutionLangIdx === idx
                              ? "bg-accent text-on-accent border-accent"
                              : "text-zinc-400 border-zinc-800 hover:text-accent hover:border-zinc-700"
                          )}
                        >
                          {sol.language === 'cpp' ? 'C++' : sol.language}
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-end gap-6 overflow-x-auto">
                      <button
                        onClick={() => handleCopy(cleanCode(activeSolutionCodeObj?.code || ''))}
                        className="text-zinc-500 hover:text-accent transition-colors shrink-0 flex items-center gap-1 text-[calc(10px*var(--fs))] font-bold"
                        title="COPY"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? "COPIED" : "COPY CODE"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Editor Content */}
                  <div className="text-[calc(10px*var(--fs))] md:text-xs overflow-x-auto">
                    <SyntaxHighlighter
                      language={
                        activeSolutionCodeObj?.language?.toLowerCase() === 'cpp' || activeSolutionCodeObj?.language?.toLowerCase() === 'c' 
                          ? 'cpp' 
                          : activeSolutionCodeObj?.language?.toLowerCase() === 'python'
                          ? 'python'
                          : activeSolutionCodeObj?.language?.toLowerCase() || 'text'
                      }
                      style={SYNTAX_THEMES[theme]}
                      showLineNumbers={true}
                      lineNumberStyle={{ minWidth: '3em', paddingRight: '1rem', color: LINE_NUMBER_COLORS[theme], textAlign: 'right', userSelect: 'none' }}
                      customStyle={{ 
                        margin: 0, 
                        padding: '1rem md:1.5rem',
                        lineHeight: '1.6',
                        fontFamily: '"Fira Code", monospace'
                      }}
                    >
                      {cleanCode(activeSolutionCodeObj?.code || '')}
                    </SyntaxHighlighter>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  {modalData.complexity && (
                    <div className="space-y-4">
                      <div className="text-[calc(9px*var(--fs))] md:text-[calc(10px*var(--fs))] font-bold text-amber-500/60 uppercase tracking-widest">
                        COMPLEXITY_ANALYSIS
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1 p-3 bg-zinc-900 border border-zinc-800 rounded">
                           <p className="text-[calc(8px*var(--fs))] uppercase text-zinc-500 mb-1">Time</p>
                           <code className="text-accent font-bold text-sm tracking-widest">{modalData.complexity.time}</code>
                        </div>
                        <div className="flex-1 p-3 bg-zinc-900 border border-zinc-800 rounded">
                           <p className="text-[calc(8px*var(--fs))] uppercase text-zinc-500 mb-1">Space</p>
                           <code className="text-accent font-bold text-sm tracking-widest">{modalData.complexity.space}</code>
                        </div>
                      </div>
                    </div>
                  )}

                  {modalData.pitfalls && modalData.pitfalls.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-[calc(9px*var(--fs))] md:text-[calc(10px*var(--fs))] font-bold text-red-500/60 uppercase tracking-widest">
                        COMMON_PITFALLS
                      </div>
                      <div className="space-y-2">
                        {modalData.pitfalls.map((pitfall, pIdx) => (
                          <div key={pIdx} className="flex gap-2 text-[calc(11px*var(--fs))] md:text-sm text-zinc-400 italic">
                             <span className="text-red-500/40">!</span>
                             <p>{pitfall}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 md:space-y-6">
                  <div className="text-[calc(9px*var(--fs))] md:text-[calc(10px*var(--fs))] font-bold text-accent/60 uppercase tracking-widest">
                     HOW_IT_WORKS.MD
                  </div>
                  <div className="prose prose-invert prose-xs max-w-none text-zinc-400 text-[calc(11px*var(--fs))] md:text-sm">
                    <Markdown 
                      remarkPlugins={[remarkMath]} 
                      rehypePlugins={[rehypeKatex]}
                      components={markdownComponents}
                    >
                      {modalData.explanation}
                    </Markdown>
                  </div>
                </div>

                {modalData.resources && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 pt-8 border-t border-line-soft">
                    <div className="space-y-4 md:space-y-6">
                      <div className="text-[calc(9px*var(--fs))] md:text-[calc(10px*var(--fs))] font-bold text-amber-500/60 uppercase tracking-widest">
                        RESOURCES:BOOKS
                      </div>
                      <div className="space-y-3">
                        {modalData.resources.books.slice(0, 3).map((book, bIdx) => (
                          <div key={bIdx} className="space-y-1">
                            <p className="text-[calc(11px*var(--fs))] md:text-xs font-bold text-zinc-300">{book.title}</p>
                            <p className="text-[calc(10px*var(--fs))] text-zinc-600">— {book.author}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 md:space-y-6">
                      <div className="text-[calc(9px*var(--fs))] md:text-[calc(10px*var(--fs))] font-bold text-accent/60 uppercase tracking-widest">
                        RESOURCES:WEB
                      </div>
                      <div className="space-y-3 md:space-y-4">
                        {modalData.resources.websites.slice(0, 3).map((res, rIdx) => (
                          <a
                            key={rIdx}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group"
                          >
                            <p className="text-[calc(11px*var(--fs))] md:text-xs text-zinc-400 group-hover:text-accent transition-colors truncate">{res.name}</p>
                            <p className="text-[calc(9px*var(--fs))] text-zinc-700 truncate">{res.url}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
