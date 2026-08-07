import React from 'react';
import { motion } from 'motion/react';
import { Terminal, Cpu, HardDrive, Sparkles, Code, ArrowRight, X, HelpCircle, Layers, CheckCircle2 } from 'lucide-react';

interface WelcomeScreenProps {
  onStart: (samplePrompt?: string) => void;
  onClose?: () => void;
  showOnStart: boolean;
  setShowOnStart: (val: boolean) => void;
}

const SAMPLE_PROMPTS = [
  {
    title: "Two Sum",
    desc: "Find two numbers in an array that add up to a target sum.",
    prompt: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. I want to solve this using a hash map."
  },
  {
    title: "LRU Cache",
    desc: "Design a data structure for Least Recently Used Cache with O(1) ops.",
    prompt: "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with O(1) time complexity for get and put operations."
  },
  {
    title: "Valid Parentheses",
    desc: "Check if string with brackets '()[]{}' is balanced and properly nested.",
    prompt: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid using a Stack."
  },
  {
    title: "Binary Search",
    desc: "Efficient O(log n) search algorithm on sorted array.",
    prompt: "Explain the binary search algorithm and guide me through searching for a target in a sorted array."
  }
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStart,
  onClose,
  showOnStart,
  setShowOnStart
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/90 backdrop-blur-md font-mono antialiased text-zinc-100 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-4xl bg-[#0d0d0d] border border-[#333] rounded-lg shadow-2xl overflow-hidden my-auto flex flex-col relative"
      >
        {/* Top Window Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e1e1e] border-b border-[#333] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
            </div>
            <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#00ff41]" />
              HINTFLOW_SYSTEM_BOOT // v1.3.0
            </span>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-[#00ff41] transition-colors p-1"
              title="Close Welcome Screen"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 md:p-8 space-y-6 md:space-y-8 overflow-y-auto max-h-[85vh]">
          {/* Header Banner */}
          <div className="space-y-3 border-b border-zinc-800/80 pb-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#00ff41]/10 border border-[#00ff41]/30 text-[#00ff41] text-[10px] font-bold tracking-widest uppercase">
              <Sparkles className="w-3 h-3 animate-spin" /> SOCRATIC ALGORITHM TUTOR
            </div>
            <h1 className="text-xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
              Master Coding Problems through <span className="text-[#00ff41]">Guided Discovery</span>
            </h1>
            <p className="text-zinc-400 text-xs md:text-sm max-w-2xl leading-relaxed">
              HintFlow scaffolds your learning using progressive hints and reflective questions instead of standard full code dumps. Build true problem-solving intuition.
            </p>
          </div>

          {/* Feature Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div
              whileHover={{ scale: 1.01 }}
              className="p-4 rounded border border-zinc-800 bg-zinc-900/40 space-y-2"
            >
              <div className="flex items-center gap-2 text-[#00ff41] text-xs font-bold uppercase tracking-wider">
                <Cpu className="w-4 h-4" /> 01 // Adaptive Scaffolding
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Receive 4 levels of hints (Analogy &rarr; Strategy &rarr; Concepts &rarr; Bottleneck snippet) tailored specifically to your logic mistakes.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.01 }}
              className="p-4 rounded border border-zinc-800 bg-zinc-900/40 space-y-2"
            >
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Code className="w-4 h-4" /> 02 // Multi-Language Solutions
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">
                When ready, unlock solutions auto-formatted for C, C++, and Python—or specify custom languages like Java, Rust, or Go in your prompt.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.01 }}
              className="p-4 rounded border border-zinc-800 bg-zinc-900/40 space-y-2"
            >
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <HardDrive className="w-4 h-4" /> 03 // Local Storage Persistence
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Every session tab, conversation history, and solved status is automatically cached in your browser so you never lose progress.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.01 }}
              className="p-4 rounded border border-zinc-800 bg-zinc-900/40 space-y-2"
            >
              <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
                <Layers className="w-4 h-4" /> 04 // Post-Mortem Analysis
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">
                After viewing the solution, engage in first-principles Q&A about memory management, time complexity, and edge cases.
              </p>
            </motion.div>
          </div>

          {/* Quick Start Samples */}
          <div className="space-y-3">
            <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest flex items-center justify-between">
              <span>&gt; QUICK_START_PROMPTS (CLICK TO LOAD)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SAMPLE_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => onStart(sample.prompt)}
                  className="p-3 text-left rounded border border-zinc-800 hover:border-[#00ff41]/50 bg-black/50 hover:bg-[#00ff41]/5 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#00ff41] group-hover:underline">
                      {sample.title}
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-600 group-hover:text-[#00ff41] transition-colors" />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
                    {sample.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 select-none">
              <input
                type="checkbox"
                checked={showOnStart}
                onChange={(e) => setShowOnStart(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-[#00ff41] focus:ring-0 accent-[#00ff41]"
              />
              <span>Show welcome screen when opening app</span>
            </label>

            <button
              onClick={() => onStart()}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#00ff41] hover:bg-[#00e038] text-black font-extrabold text-xs uppercase tracking-wider rounded transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-[#00ff41]/10"
            >
              <span>[ ENTER TERMINAL SESSION ]</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
