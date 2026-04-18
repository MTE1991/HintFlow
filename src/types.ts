export interface HintFlowResponse {
  overview: string;
  hints: string[];
  solutions: {
    c: string;
    cpp: string;
    python: string;
  };
  explanation: string;
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
}
