export enum Category {
  Coding = "coding",
  AiCoding = "ai coding",
}

export type Heartbeat = {
  entity: string;
  type: "file" | "app" | "domain";
  category: Category;
  time: number;
  project?: string;
  branch?: string;
  language?: string;
  is_write?: boolean;
  agent?: string;
  editor?: string;
  ai_session?: string;
  ai_model?: string;
  machine?: string;
};

export type UsageSample = {
  source_id: string;
  time: number;
  agent: string;
  model: string;
  project: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
};

export const hasTokens = (sample: UsageSample) =>
  sample.input_tokens + sample.output_tokens + sample.cache_read_tokens + sample.cache_write_tokens > 0;
