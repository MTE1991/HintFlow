/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Terminal, Send, ChevronRight, Lightbulb, Code, RefreshCcw, Info, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { HintFlowResponse, Message } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SYSTEM_INSTRUCTION = `You are HintFlow, a Socratic coding tutor for beginner computer science students. 
Your goal is to help users solve programming problems by providing progressive hints rather than immediate solutions.

IMPORTANT: All code solutions MUST be written in Python.

When a user provides a problem statement:
1. Provide a high-level overview of the concept.
2. Provide exactly 3-4 progressive hints. 
   - Hint 1: High-level conceptual nudge.
   - Hint 2: Logical structure or algorithm hint.
   - Hint 3: Specific syntax or implementation detail.
3. Provide the full solution (Python code only, well-formatted with newlines) and a detailed explanation.

You MUST respond in JSON format matching this schema:
{
  "overview": "string",
  "hints": ["string", "string", "string"],
  "solution": "string", // Ensure this contains newlines for readability
  "explanation": "string"
}`;

export default function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeSession, setActiveSession] = useState<HintFlowResponse | null>(null);
  const [visibleHintsCount, setVisibleHintsCount] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
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
              overview: { type: Type.STRING },
              hints: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              solution: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["overview", "hints", "solution", "explanation"]
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
                  <Markdown>
                    {msg.content}
                  </Markdown>
                </div>
              </div>

              {/* Progressive Hints UI */}
              {msg.data && (
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
                          <Markdown>{hint}</Markdown>
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
                      <div className="p-4 bg-zinc-900 border border-amber-500/20 rounded-lg">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-widest mb-3">
                          <CheckCircle2 className="w-3 h-3" />
                          Solution Implementation
                        </div>
                        <div className="rounded-lg border border-zinc-800 overflow-hidden text-xs bg-black/30">
                          <SyntaxHighlighter
                            language="python"
                            style={vscDarkPlus}
                            showLineNumbers={true}
                            lineNumberStyle={{ minWidth: '2.5em', paddingRight: '1em', color: '#4b5563', textAlign: 'right' }}
                            customStyle={{ 
                              margin: 0, 
                              background: 'transparent',
                              padding: '1.5rem',
                              lineHeight: '1.6'
                            }}
                          >
                            {msg.data.solution}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                      <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg text-sm italic text-zinc-400">
                        <Markdown>{msg.data.explanation}</Markdown>
                      </div>
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
