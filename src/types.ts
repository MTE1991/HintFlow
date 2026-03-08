export interface HintFlowResponse {
  overview: string;
  hints: string[];
  solution: string;
  explanation: string;
  isRelevant: boolean;
  resources?: { name: string; url: string }[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: HintFlowResponse;
}
