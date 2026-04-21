export interface HintFlowResponse {
  overview: string;
  hints: string[];
  solution?: string;
  language?: 'c' | 'cpp' | 'python';
  explanation?: string;
  isRelevant: boolean;
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
