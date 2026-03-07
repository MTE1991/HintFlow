export interface HintFlowResponse {
  overview: string;
  hints: string[];
  solution: string;
  explanation: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: HintFlowResponse;
}
