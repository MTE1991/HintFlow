export interface HintFlowResponse {
  isRelevant: boolean;
  topic_tags?: string[];
  difficulty_score?: number;
  overview: string;
  hints: string[];
  reflective_question?: string;
  solution?: string;
  language?: 'c' | 'cpp' | 'python';
  complexity?: { time: string; space: string };
  explanation?: string;
  pitfalls?: string[];
  technical_depth_score?: number;
  resources?: {
    books: { title: string; author: string }[];
    websites: { name: string; url: string }[];
  };
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: HintFlowResponse;
  isFollowUp?: boolean;
}

export interface Tab {
  id: string;
  title: string;
  messages: Message[];
  activeSession: HintFlowResponse | null;
  visibleHintsCount: number;
  solved: boolean;
  preferredLanguage: 'c' | 'cpp' | 'python';
}
