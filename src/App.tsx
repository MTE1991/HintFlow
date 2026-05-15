/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Terminal, Send, ChevronRight, Lightbulb, Code, RefreshCcw, Info, CheckCircle2, BookOpen, Globe, Copy, Check, X, Plus, MessageSquare, History } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { HintFlowResponse, Message, Tab } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const markdownComponents = {
  code({ inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <div className="my-3 rounded-lg overflow-hidden border border-zinc-800">
        <SyntaxHighlighter
          language={match[1]}
          style={vscDarkPlus}
          PreTag="div"
          customStyle={{ 
            margin: 0, 
            background: '#000',
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
      <code className={cn("bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] font-mono text-amber-500/80", className)} {...props}>
        {children}
      </code>
    );
  },
};

const HINTS_INSTRUCTION = (lang: string) => `You are **HintFlow**, a specialized Socratic tutor. 
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
   - **Level 3**: Specific ${lang} features/functions to use.
   - **Level 4**: Minimal code snippet (3-5 lines) of the "bottleneck" logic only.
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

const SOLUTION_INSTRUCTION = (lang: string) => `You are the **HintFlow Expert Implementation Consultant**.
The user is ready for the "Golden Path" solution.

### 🏗️ Content Generation Guidelines
1. **Full Solution**: Production-grade, idiomatic ${lang}.
2. **Deep Dive**: 
   - Explain the logic clearly.
   - **Complexity**: Mandatory Time/Space complexity analysis.
   - **Trade-offs**: Briefly mention one alternative way to solve this (e.g., Iterative vs Recursive) and why this version was chosen.
3. **Common Pitfalls**: Mention 2 common bugs students make with this specific problem.

### 📤 Response Format
{
  "solution": "string",
  "language": "${lang}",
  "complexity": { "time": "O(?)", "space": "O(?)" },
  "explanation": "string",
  "pitfalls": ["string", "string"],
  "resources": {
    "books": [{ "title": "string", "author": "string" }],
    "websites": [{ "name": "string", "url": "string" }]
  }
}`;

const FOLLOWUP_INSTRUCTION = (lang: string) => `You are the **HintFlow Expert Implementation Consultant**. 
The user has the solution and is now performing a "Post-Mortem" analysis.

### 🏗️ Content Generation Guidelines
- **Academic Depth**: Use first-principles reasoning to explain "under the hood" mechanics (e.g., Memory management in ${lang}, Stack frames).
- **Practicality**: Connect the user's question to real-world engineering scenarios.
- **Format**: Use Markdown for code snippets and bold text for key terms.

### 📤 Response Format
{
  "overview": "multi-paragraph string",
  "technical_depth_score": 1-5,
  "hints": []
}`;

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([{
    id: 'initial',
    title: 'New Session',
    messages: [],
    activeSession: null,
    visibleHintsCount: 0,
    solved: false,
    preferredLanguage: 'python'
  }]);
  const [activeTabId, setActiveTabId] = useState('initial');
  
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const { messages, activeSession, visibleHintsCount, solved, preferredLanguage } = activeTab;

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSolutionLoading, setIsSolutionLoading] = useState(false);
  const [modalData, setModalData] = useState<HintFlowResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [tabs, activeTabId, activeTab.visibleHintsCount, modalData]);

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
      solved: false,
      preferredLanguage: activeTab.preferredLanguage
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(id);
    return id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    // If it's a follow-up in a solved tab, we don't create a new tab, just add to existing
    let currentTabId = activeTabId;
    let isFollowUp = solved;

    // If active tab has no messages, it's the "New Session" tab being used for the first time
    if (!solved && messages.length === 0) {
      updateActiveTab({ 
        title: userMessage.length > 20 ? userMessage.substring(0, 20) + '...' : userMessage,
        messages: [{ role: 'user', content: userMessage }]
      });
    } else if (!solved) {
      // Normal progression logic - though usually each new top-level problem should be a new tab
      // However, if it's the SAME problem being discussed, stay in tab.
      // THE REQUIREMENT says "For every prompt, make a new tab". I'll interpret "prompt" as "top-level problem statement".
      // If messages.length > 0 and NOT solved, user might be asking a clarifying question about hints.
      // But let's follow the "Every prompt -> new tab" for new problems.
      currentTabId = createNewTab(userMessage);
      setTabs(prev => prev.map(t => t.id === currentTabId ? { 
        ...t, 
        messages: [{ role: 'user', content: userMessage }] 
      } : t));
    } else {
      // It's SOLVED, so it's a follow-up
      updateActiveTab({
        messages: [...messages, { role: 'user', content: userMessage, isFollowUp: true }]
      });
    }

    setIsLoading(true);

    try {
      const activeTabState = tabs.find(t => t.id === (isFollowUp ? activeTabId : currentTabId)) || activeTab;
      
      // Construct context for the AI
      const chatHistory = activeTabState.messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const customInstruction = isFollowUp 
        ? FOLLOWUP_INSTRUCTION(activeTabState.preferredLanguage)
        : HINTS_INSTRUCTION(activeTabState.preferredLanguage);

      const responseSchemaPhase1 = {
        type: Type.OBJECT,
        properties: {
          isRelevant: { type: Type.BOOLEAN },
          topic_tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          difficulty_score: { type: Type.NUMBER },
          overview: { type: Type.STRING },
          hints: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          reflective_question: { type: Type.STRING }
        },
        required: ["isRelevant", "topic_tags", "difficulty_score", "overview", "hints", "reflective_question"]
      };

      const responseSchemaFollowUp = {
        type: Type.OBJECT,
        properties: {
          overview: { type: Type.STRING },
          technical_depth_score: { type: Type.NUMBER },
          hints: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["overview", "technical_depth_score", "hints"]
      };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMessage,
        config: {
          systemInstruction: customInstruction,
          responseMimeType: "application/json",
          responseSchema: isFollowUp ? responseSchemaFollowUp : responseSchemaPhase1
        },
      });

      const data = JSON.parse(response.text || '{}') as HintFlowResponse;
      
      setTabs(prev => prev.map(t => {
        if (t.id === (isFollowUp ? activeTabId : currentTabId)) {
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
        if (t.id === (isFollowUp ? activeTabId : currentTabId)) {
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

  const revealNextHint = () => {
    if (activeSession && visibleHintsCount < activeSession.hints.length) {
      updateActiveTab({ visibleHintsCount: visibleHintsCount + 1 });
    }
  };

  const markAsSolved = async (data: HintFlowResponse) => {
    // If we already have the solution (rare case now), just show it
    if (data.solution) {
      setModalData(data);
      updateActiveTab({ solved: true });
      return;
    }

    setIsSolutionLoading(true);
    try {
      const problemStatement = activeTab.messages.length > 0 ? activeTab.messages[0].content : '';
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide the full solution for this coding problem: ${problemStatement}`,
        config: {
          systemInstruction: SOLUTION_INSTRUCTION(activeTab.preferredLanguage),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              solution: { type: Type.STRING },
              language: { type: Type.STRING },
              complexity: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  space: { type: Type.STRING }
                },
                required: ["time", "space"]
              },
              explanation: { type: Type.STRING },
              pitfalls: { type: Type.ARRAY, items: { type: Type.STRING } },
              resources: {
                type: Type.OBJECT,
                properties: {
                  books: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        author: { type: Type.STRING }
                      },
                      required: ["title", "author"]
                    }
                  },
                  websites: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        url: { type: Type.STRING }
                      },
                      required: ["name", "url"]
                    }
                  }
                },
                required: ["books", "websites"]
              }
            },
            required: ["solution", "language", "complexity", "explanation", "pitfalls", "resources"]
          }
        },
      });

      const solutionData = JSON.parse(response.text || '{}');
      const fullResponse: HintFlowResponse = {
        ...data,
        ...solutionData
      };

      setTabs(prev => prev.map(t => t.id === activeTabId ? {
        ...t,
        activeSession: fullResponse,
        solved: true,
        messages: t.messages.map(m => m.data === data ? { ...m, data: fullResponse } : m)
      } : t));
      
      setModalData(fullResponse);
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
    setTabs([{
      id: 'initial',
      title: 'New Session',
      messages: [],
      activeSession: null,
      visibleHintsCount: 0,
      solved: false,
      preferredLanguage: 'python'
    }]);
    setActiveTabId('initial');
    setModalData(null);
    setInput('');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanCode = (code: string) => {
    return code
      .trim()
      .replace(/\n{3,}/g, '\n\n');
  };

  return (
    <div className="h-[100dvh] w-full flex items-center justify-center p-0 md:p-4 lg:p-8 bg-black overflow-hidden font-mono antialiased">
      {/* Terminal Window */}
      <div className="w-full h-full max-w-6xl md:h-[90vh] flex flex-col bg-[#0c0c0c] md:border md:border-[#333] shadow-2xl relative overflow-hidden md:rounded-lg">
        
        {/* Title Bar - More compact on mobile */}
        <div className="flex items-center justify-between px-3 py-2 md:px-4 bg-[#2d2d2d] border-b border-[#333] shrink-0">
          <div className="flex items-center gap-3 md:gap-6 overflow-hidden">
            <div className="hidden md:flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
            </div>
            <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-zinc-400 truncate">
              <Terminal className="w-3 md:w-3.5 h-3 md:h-3.5 shrink-0" />
              <span className="truncate">hintflow — user — 80x24</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button 
                onClick={reset}
                className="text-zinc-500 hover:text-red-500 transition-colors p-1"
                title="Reset Terminal"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
              </button>
          </div>
        </div>

        {/* Tab Bar (Tmux style) */}
        <div className="flex items-center bg-[#1a1a1a] px-2 py-1 shrink-0 gap-1 overflow-x-auto no-scrollbar">
           {tabs.map((tab, idx) => (
            <div
              key={tab.id}
              className={cn(
                "group/tab flex items-center gap-2 px-3 py-1 text-[10px] font-bold cursor-pointer transition-colors border-r border-[#333]/30",
                activeTabId === tab.id 
                  ? "bg-[#00ff41] text-black" 
                  : "text-[#00ff41]/50 hover:bg-[#252525]"
              )}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span>{idx}: {tab.title}</span>
              {tab.solved && <span className="text-[8px]">●</span>}
              <button
                onClick={(e) => closeTab(e, tab.id)}
                className={cn(
                  "opacity-0 group-hover/tab:opacity-100 hover:text-red-500 transition-opacity",
                  activeTabId === tab.id && "opacity-60 text-black hover:text-red-900"
                )}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          <button 
            onClick={() => createNewTab()}
            className="px-3 py-1 text-[10px] font-bold text-[#00ff41]/30 hover:text-[#00ff41] transition-colors"
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
              <div className="space-y-4 opacity-80 text-xs md:text-sm">
                <div className="text-[#00ff41]">
                  <p>HintFlow OS v1.2.0 (tty1)</p>
                  <p>Login successful: user@hintflow</p>
                  <p className="hidden md:block">Last login: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-zinc-500 leading-relaxed max-w-xl">
                    Welcome to <span className="text-[#00ff41] font-bold italic">HintFlow</span>. I am a Socratic tutor optimized for C, C++, and Python.
                  </p>
                  <p className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest mt-4">
                    SYSTEM: Listening for problem statement at stdin...
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className="space-y-3">
                {/* Prompt Line */}
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                  <div className="flex items-center gap-2 text-[10px] md:text-xs">
                    <span className={cn(
                      "font-bold shrink-0",
                      msg.role === 'user' ? "text-[#00ff41]" : "text-amber-500"
                    )}>
                      [{msg.role === 'user' ? 'student' : 'mentor'}@hintflow]$
                    </span>
                    <span className="text-zinc-600 text-[9px] md:text-[10px] uppercase font-bold tracking-tighter shrink-0">
                      {msg.isFollowUp ? "# follow-up" : "# core"}
                    </span>
                    {msg.data?.topic_tags && (
                      <div className="flex gap-1 overflow-hidden">
                        {msg.data.topic_tags.map((tag, tIdx) => (
                          <span key={tIdx} className="text-[8px] md:text-[9px] px-1 bg-zinc-800 text-zinc-500 rounded border border-zinc-700">
                             {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.data?.difficulty_score && (
                      <span className="text-[8px] md:text-[9px] text-[#00ff41]/40 px-1 border border-[#00ff41]/20 rounded font-mono">
                        DIFF: {msg.data.difficulty_score}/10
                      </span>
                    )}
                    {msg.data?.technical_depth_score && (
                      <span className="text-[8px] md:text-[9px] text-amber-500/40 px-1 border border-amber-500/20 rounded font-mono">
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
                  <div className="prose prose-invert prose-xs max-w-none prose-p:leading-relaxed prose-code:text-[#00ff41] prose-code:bg-transparent prose-code:p-0 text-[12px] md:text-sm">
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
                    <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold text-[#00ff41]/40 uppercase tracking-widest border-t border-zinc-900 pt-4">
                       &gt;&gt; LEARNING_PATH
                    </div>
                    
                    <div className="space-y-4">
                      {msg.data.hints.slice(0, visibleHintsCount).map((hint, hIdx) => (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          key={hIdx}
                          className="flex gap-2 md:gap-4"
                        >
                          <span className="text-[#00ff41]/30 shrink-0 select-none text-[10px] md:text-sm">H0{hIdx + 1}:</span>
                          <div className="prose prose-invert prose-xs leading-relaxed text-zinc-400 text-[11px] md:text-sm">
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
                          className="mt-6 p-3 md:p-4 bg-[#00ff41]/5 border border-[#00ff41]/10 rounded-sm"
                        >
                          <div className="text-[9px] md:text-[10px] font-bold text-[#00ff41] uppercase tracking-widest mb-2 flex items-center gap-2">
                             <MessageSquare className="w-3 h-3" /> THINK_ABOUT_THIS
                          </div>
                          <p className="text-[11px] md:text-sm text-[#00ff41]/80 leading-relaxed italic">
                            {msg.data.reflective_question}
                          </p>
                        </motion.div>
                      )}
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 md:gap-6">
                      {visibleHintsCount < msg.data.hints.length && (
                        <button
                          onClick={revealNextHint}
                          className="text-[10px] md:text-[11px] font-bold text-[#00ff41] hover:underline uppercase tracking-widest text-left"
                        >
                          [ REVEAL_HINT ({visibleHintsCount}/{msg.data.hints.length}) ]
                        </button>
                      )}

                      {visibleHintsCount === msg.data.hints.length && (
                        <button
                          onClick={() => markAsSolved(msg.data!)}
                          disabled={isSolutionLoading}
                          className={cn(
                            "text-[10px] md:text-[11px] font-bold text-amber-500 hover:underline uppercase tracking-widest text-left",
                            isSolutionLoading && "opacity-50 cursor-wait"
                          )}
                        >
                          {isSolutionLoading ? "[ SYTEM: COMPILING_SOLUTION... ]" : "[ SHOW_SOLUTION ]"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-4 text-[#00ff41]/60 text-[10px] font-bold animate-pulse pl-2">
                <span>_</span>
                <span>SYSTEM: THINKING...</span>
              </div>
            )}
          </div>

          {/* Prompt Area */}
          <div className="mt-auto pt-4 md:pt-6 border-t border-[#333]/50">
             <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
               {solved ? (
                <div className="text-[9px] md:text-[10px] text-amber-500/60 uppercase tracking-widest italic">
                  # Follow-up enabled. Ask questions about the implementation.
                </div>
               ) : (
                <div className="flex items-center gap-4">
                  <span className="text-[9px] md:text-[10px] text-[#00ff41]/40 uppercase tracking-widest font-bold">Target Language:</span>
                  <div className="flex items-center gap-2">
                    {(['python', 'cpp', 'c'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => updateActiveTab({ preferredLanguage: lang })}
                        className={cn(
                          "px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest transition-all border",
                          preferredLanguage === lang 
                            ? "bg-[#00ff41] text-black border-[#00ff41]" 
                            : "text-[#00ff41] border-[#00ff41]/20 hover:border-[#00ff41]/50"
                        )}
                        disabled={isLoading}
                      >
                        {lang === 'cpp' ? 'C++' : lang}
                      </button>
                    ))}
                  </div>
                </div>
               )}
               {!solved && messages.length > 0 && (
                 <div className="text-[9px] text-[#00ff41]/30 italic">
                   * Language locked for this active session.
                 </div>
               )}
             </div>

            <form 
              onSubmit={handleSubmit}
              className="flex flex-col md:flex-row md:items-start gap-1 md:gap-2 group"
            >
              <div className="text-[#00ff41] shrink-0 md:py-1 text-[10px] md:text-sm font-bold opacity-60 md:opacity-100">
                 student@hintflow %
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
                placeholder={solved ? "ASK_DESC..." : "INPUT_PROBLEM..."}
                className="flex-1 bg-transparent border-none text-[#00ff41] placeholder:text-[#00ff41]/20 focus:outline-none resize-none overflow-hidden max-h-40 py-1 text-[13px] md:text-sm"
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
          <div className="fixed inset-0 h-[100dvh] w-full z-50 flex items-center justify-center p-0 md:p-8 lg:p-16 bg-black/95 md:bg-black/90 backdrop-blur-sm uppercase-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full h-full max-w-6xl md:rounded-lg bg-[#0c0c0c] border border-[#333]/50 md:border-[#333] flex flex-col shadow-2xl relative overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-3 md:px-4 py-2 bg-[#1a1a1a] border-b border-[#333] shrink-0">
                 <div className="flex items-center gap-2 md:gap-3">
                    <span className="text-[#00ff41] font-bold text-[10px] md:text-xs tracking-widest italic truncate">_VIEW: SOLUTION.LOG</span>
                 </div>
                 <button
                  onClick={() => setModalData(null)}
                  className="text-zinc-600 hover:text-[#00ff41] transition-colors font-bold text-[10px] md:text-xs p-1"
                >
                  [ CLOSE ]
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 md:space-y-12 terminal-scroll">
                <div className="bg-black/40 border border-[#222] rounded overflow-hidden">
                  {/* Editor Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between px-3 py-2 bg-[#111] border-b border-[#222] gap-3">
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] md:text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                        SRC: solution.{modalData.language === 'cpp' ? 'cpp' : modalData.language}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between md:justify-end gap-6 overflow-x-auto">
                      <div className="flex items-center gap-2 shrink-0">
                         <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest border-b border-amber-500">
                           {modalData.language === 'cpp' ? 'C++' : modalData.language}
                         </span>
                      </div>
                      <button
                        onClick={() => handleCopy(cleanCode(modalData.solution))}
                        className="text-zinc-500 hover:text-[#00ff41] transition-colors shrink-0"
                        title="COPY"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Editor Content */}
                  <div className="text-[10px] md:text-xs overflow-x-auto">
                    <SyntaxHighlighter
                      language={modalData.language === 'python' ? 'python' : 'cpp'}
                      style={vscDarkPlus}
                      showLineNumbers={true}
                      lineNumberStyle={{ minWidth: '3em', paddingRight: '1rem', color: '#222', textAlign: 'right', userSelect: 'none' }}
                      customStyle={{ 
                        margin: 0, 
                        background: 'transparent',
                        padding: '1rem md:1.5rem',
                        lineHeight: '1.6',
                        fontFamily: '"Fira Code", monospace'
                      }}
                    >
                      {cleanCode(modalData.solution)}
                    </SyntaxHighlighter>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  {modalData.complexity && (
                    <div className="space-y-4">
                      <div className="text-[9px] md:text-[10px] font-bold text-amber-500/60 uppercase tracking-widest">
                        COMPLEXITY_ANALYSIS
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1 p-3 bg-zinc-900 border border-zinc-800 rounded">
                           <p className="text-[8px] uppercase text-zinc-500 mb-1">Time</p>
                           <code className="text-[#00ff41] font-bold text-sm tracking-widest">{modalData.complexity.time}</code>
                        </div>
                        <div className="flex-1 p-3 bg-zinc-900 border border-zinc-800 rounded">
                           <p className="text-[8px] uppercase text-zinc-500 mb-1">Space</p>
                           <code className="text-[#00ff41] font-bold text-sm tracking-widest">{modalData.complexity.space}</code>
                        </div>
                      </div>
                    </div>
                  )}

                  {modalData.pitfalls && modalData.pitfalls.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-[9px] md:text-[10px] font-bold text-red-500/60 uppercase tracking-widest">
                        COMMON_PITFALLS
                      </div>
                      <div className="space-y-2">
                        {modalData.pitfalls.map((pitfall, pIdx) => (
                          <div key={pIdx} className="flex gap-2 text-[11px] md:text-sm text-zinc-400 italic">
                             <span className="text-red-500/40">!</span>
                             <p>{pitfall}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 md:space-y-6">
                  <div className="text-[9px] md:text-[10px] font-bold text-[#00ff41]/60 uppercase tracking-widest">
                     HOW_IT_WORKS.MD
                  </div>
                  <div className="prose prose-invert prose-xs max-w-none text-zinc-400 text-[11px] md:text-sm">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 pt-8 border-t border-[#222]">
                    <div className="space-y-4 md:space-y-6">
                      <div className="text-[9px] md:text-[10px] font-bold text-amber-500/60 uppercase tracking-widest">
                        RESOURCES:BOOKS
                      </div>
                      <div className="space-y-3">
                        {modalData.resources.books.slice(0, 3).map((book, bIdx) => (
                          <div key={bIdx} className="space-y-1">
                            <p className="text-[11px] md:text-xs font-bold text-zinc-300">{book.title}</p>
                            <p className="text-[10px] text-zinc-600">— {book.author}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 md:space-y-6">
                      <div className="text-[9px] md:text-[10px] font-bold text-[#00ff41]/60 uppercase tracking-widest">
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
                            <p className="text-[11px] md:text-xs text-zinc-400 group-hover:text-[#00ff41] transition-colors truncate">{res.name}</p>
                            <p className="text-[9px] text-zinc-700 truncate">{res.url}</p>
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
