/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Terminal, Send, ChevronRight, Lightbulb, Code, RefreshCcw, Info, CheckCircle2, BookOpen, Globe, Copy, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { HintFlowResponse, Message } from './types';

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

const SYSTEM_INSTRUCTION = `You are HintFlow, a Socratic coding tutor for beginner computer science students. 
Your goal is to help users solve programming problems by providing progressive hints rather than immediate solutions.

IMPORTANT: You MUST provide code solutions in C, C++, and Python.

RELEVANCE CHECK:
Before processing, determine if the user's prompt is a programming problem or a request for coding help.
- If it IS a programming problem: Set "isRelevant" to true and provide the overview, hints, and solutions.
- If it IS NOT a programming problem (e.g., general chat, life advice, non-coding questions): Set "isRelevant" to false, set "overview" to a polite message explaining that you only help with programming problems, and leave "hints", "solutions", "explanation", and "resources" as empty.

When a user provides a programming problem statement:
1. Provide a high-level overview of the concept.
2. Provide exactly 3-4 progressive hints. 
   - Hint 1: High-level conceptual nudge.
   - Hint 2: Logical structure or algorithm hint.
   - Hint 3: Specific syntax or implementation detail.
   - MATH SUPPORT: Use LaTeX syntax for math symbols, formulas, and equations when helpful for clarity (e.g., $O(n^2)$, $\sum_{i=1}^{n} i$, or Big O notation). Use single dollar signs $...$ for inline math and double dollar signs $$...$$ for block equations.
   - CODE SNIPPETS: Include small code snippets (1-5 lines) in the hints when explaining syntax or structural logic. Wrap them in markdown code blocks.
3. Provide the full solution in three languages: C, C++, and Python.
   - FORMATTING: Ensure all code follows industry-standard formatting.
   - Python: Strictly follow PEP 8 (4-space indentation, snake_case, etc.).
   - C/C++: Follow standard conventions (consistent indentation, clear variable naming, proper use of include guards/headers).
4. Provide a detailed explanation of the logic.
5. Provide learning resources:
   - exactly 3 relevant books (include "title" and "author").
   - exactly 3 relevant websites/webpages (include "name" and "url").
   - If no relevant books are found for this specific topic, leave the "books" array empty.

You MUST respond in JSON format matching this schema:
{
  "isRelevant": boolean,
  "overview": "string",
  "hints": ["string", "string", "string"],
  "solutions": {
    "c": "string",
    "cpp": "string",
    "python": "string"
  },
  "explanation": "string",
  "resources": {
    "books": [{ "title": "string", "author": "string" }],
    "websites": [{ "name": "string", "url": "string" }]
  }
}`;

export default function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeSession, setActiveSession] = useState<HintFlowResponse | null>(null);
  const [visibleHintsCount, setVisibleHintsCount] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [selectedLang, setSelectedLang] = useState<'c' | 'cpp' | 'python'>('python');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, visibleHintsCount, showSolution]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setVisibleHintsCount(0);
    setShowSolution(false);
    setActiveSession(null);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userMessage,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isRelevant: { type: Type.BOOLEAN },
              overview: { type: Type.STRING },
              hints: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              solutions: {
                type: Type.OBJECT,
                properties: {
                  c: { type: Type.STRING },
                  cpp: { type: Type.STRING },
                  python: { type: Type.STRING }
                },
                required: ["c", "cpp", "python"]
              },
              explanation: { type: Type.STRING },
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
            required: ["isRelevant", "overview", "hints", "solutions", "explanation", "resources"]
          }
        },
      });

      const data = JSON.parse(response.text || '{}') as HintFlowResponse;
      setActiveSession(data);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.overview,
        data: data
      }]);
    } catch (error) {
      console.error("Error generating hints:", error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I encountered an error while processing your request. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const revealNextHint = () => {
    if (activeSession && visibleHintsCount < activeSession.hints.length) {
      setVisibleHintsCount(prev => prev + 1);
    }
  };

  const reset = () => {
    setMessages([]);
    setActiveSession(null);
    setVisibleHintsCount(0);
    setShowSolution(false);
    setInput('');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8">
      {/* Header */}
      <header className="w-full max-w-4xl mb-8 flex items-center justify-between border-b border-green-500/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg terminal-border">
            <Terminal className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-green-500 terminal-glow">HintFlow</h1>
            <p className="text-xs text-green-500/60 uppercase tracking-widest">Socratic Coding Agent v1.0</p>
          </div>
        </div>
        <button 
          onClick={reset}
          className="p-2 hover:bg-green-500/10 rounded-full transition-colors text-green-500/60 hover:text-green-500"
          title="Reset Session"
        >
          <RefreshCcw className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl flex-1 flex flex-col gap-6 overflow-hidden">
        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-green-500/20"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
              <Info className="w-12 h-12 text-green-500" />
              <div className="max-w-md">
                <p className="text-lg">Paste a problem statement to begin.</p>
                <p className="text-sm">HintFlow will guide you through the logic without giving away the answer immediately.</p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={cn(
              "flex flex-col gap-2",
              msg.role === 'user' ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "max-w-[85%] p-4 rounded-xl text-sm leading-relaxed",
                msg.role === 'user' 
                  ? "bg-green-500/10 border border-green-500/20 text-green-400" 
                  : "bg-zinc-900 border border-zinc-800 text-zinc-300"
              )}>
                <div className="flex items-center gap-2 mb-2 opacity-50 text-[10px] uppercase tracking-wider font-bold">
                  {msg.role === 'user' ? 'Student' : 'HintFlow'}
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <Markdown 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </Markdown>
                </div>
              </div>

              {/* Progressive Hints UI */}
              {msg.data && msg.data.isRelevant && (
                <div className="w-full mt-4 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-green-500/60 uppercase tracking-widest mb-2">
                    <Lightbulb className="w-3 h-3" />
                    Progressive Hints
                  </div>
                  
                  <div className="grid gap-3">
                    {msg.data.hints.slice(0, visibleHintsCount).map((hint, hIdx) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={hIdx}
                        className="p-4 bg-zinc-900/50 border border-green-500/20 rounded-lg text-sm flex gap-3"
                      >
                        <span className="text-green-500 font-bold shrink-0">0{hIdx + 1}.</span>
                        <div className="prose prose-invert prose-sm">
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
                  </div>

                  {visibleHintsCount < msg.data.hints.length && (
                    <button
                      onClick={revealNextHint}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-500 text-xs font-bold hover:bg-green-500/20 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                      Reveal Next Hint ({visibleHintsCount}/{msg.data.hints.length})
                    </button>
                  )}

                  {visibleHintsCount === msg.data.hints.length && !showSolution && (
                    <button
                      onClick={() => setShowSolution(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold hover:bg-amber-500/20 transition-all"
                    >
                      <Code className="w-4 h-4" />
                      Reveal Full Solution
                    </button>
                  )}

                  {showSolution && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-4"
                    >
                      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
                        {/* Editor Header */}
                        <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 border-b border-zinc-800">
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/40" />
                              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/40" />
                              <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/40" />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                              <Code className="w-3 h-3" />
                              solution.{selectedLang === 'cpp' ? 'cpp' : selectedLang}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center bg-black/40 rounded p-0.5 border border-zinc-700/50">
                              {(['c', 'cpp', 'python'] as const).map((lang) => (
                                <button
                                  key={lang}
                                  onClick={() => setSelectedLang(lang)}
                                  className={cn(
                                    "px-2 py-0.5 text-[9px] font-bold rounded uppercase transition-all",
                                    selectedLang === lang 
                                      ? "bg-amber-500/20 text-amber-500" 
                                      : "text-zinc-600 hover:text-zinc-400"
                                  )}
                                >
                                  {lang === 'cpp' ? 'C++' : lang}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => handleCopy(msg.data.solutions[selectedLang])}
                              className="p-1 hover:bg-zinc-700 rounded transition-colors text-zinc-500 hover:text-zinc-300 relative group"
                              title="Copy Code"
                            >
                              <AnimatePresence mode="wait">
                                {copied ? (
                                  <motion.div
                                    key="check"
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.5, opacity: 0 }}
                                  >
                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="copy"
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.5, opacity: 0 }}
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </button>
                          </div>
                        </div>

                        {/* Editor Content */}
                        <div className="text-xs bg-black/20">
                          <SyntaxHighlighter
                            language={selectedLang === 'python' ? 'python' : 'cpp'}
                            style={vscDarkPlus}
                            showLineNumbers={true}
                            lineNumberStyle={{ minWidth: '3em', paddingRight: '1.5em', color: '#374151', textAlign: 'right', userSelect: 'none' }}
                            customStyle={{ 
                              margin: 0, 
                              background: 'transparent',
                              padding: '1.5rem',
                              lineHeight: '1.7',
                              fontFamily: '"Fira Code", monospace'
                            }}
                          >
                            {msg.data.solutions[selectedLang]}
                          </SyntaxHighlighter>
                        </div>

                        {/* Editor Footer / Status Bar */}
                        <div className="flex items-center justify-between px-4 py-1.5 bg-zinc-800/30 border-t border-zinc-800 text-[9px] font-mono text-zinc-600">
                          <div className="flex items-center gap-4">
                            <span>Ln {msg.data.solutions[selectedLang].split('\n').length}, Col 1</span>
                            <span>UTF-8</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500/40" />
                              Ready
                            </span>
                            <span className="uppercase">{selectedLang === 'cpp' ? 'C++' : selectedLang === 'c' ? 'C' : 'Python 3'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg text-sm italic text-zinc-400">
                        <Markdown 
                          remarkPlugins={[remarkMath]} 
                          rehypePlugins={[rehypeKatex]}
                          components={markdownComponents}
                        >
                          {msg.data.explanation}
                        </Markdown>
                      </div>

                      {msg.data.resources && (
                        <div className="pt-4 border-t border-zinc-800/50 space-y-6">
                          {/* Books Section */}
                          {msg.data.resources.books.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                                <BookOpen className="w-3 h-3 text-amber-500/60" />
                                Recommended Books
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {msg.data.resources.books.map((book, bIdx) => (
                                  <div
                                    key={bIdx}
                                    className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg flex flex-col justify-between"
                                  >
                                    <span className="text-xs font-bold text-zinc-300 leading-tight mb-1">{book.title}</span>
                                    <span className="text-[10px] text-zinc-500 italic">— {book.author}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Websites Section */}
                          {msg.data.resources.websites.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                                <Globe className="w-3 h-3 text-green-500/60" />
                                Online Resources
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {msg.data.resources.websites.map((res, rIdx) => (
                                  <a
                                    key={rIdx}
                                    href={res.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-green-500/30 transition-all group"
                                  >
                                    <span className="text-xs text-zinc-400 group-hover:text-green-400 transition-colors line-clamp-1">{res.name}</span>
                                    <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-green-500" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-3 text-green-500/50 text-xs font-bold animate-pulse">
              <Terminal className="w-4 h-4" />
              Processing problem statement...
            </div>
          )}
        </div>

        {/* Input Area */}
        <form 
          onSubmit={handleSubmit}
          className="relative mt-auto"
        >
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500/50">
            <ChevronRight className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your coding problem here..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-16 text-sm focus:outline-none focus:border-green-500/50 transition-colors placeholder:text-zinc-600"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-green-500 text-black rounded-lg hover:bg-green-400 disabled:opacity-50 disabled:hover:bg-green-500 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="mt-8 text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
        HintFlow // Built for Beginners // No Spoilers
      </footer>
    </div>
  );
}
