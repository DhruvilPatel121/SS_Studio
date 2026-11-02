export class GeminiError extends Error { code: string; partialText: string; constructor(code: string, partialText?: string); }
export type State = 'waiting'|'streaming'|'completed'|'cancelled'|'failed';
export type Content = {role:'user'|'model'; parts:{text:string}[]};
export type Result = {text:string; usage:Record<string, unknown>|null; model:string|null; finishReason:string};
export function createGeminiParser(options?: {onText?:(delta:string,full:string)=>void; onUsage?:(usage:Record<string, unknown>)=>void}): {push(bytes:Uint8Array):void; end():Result; readonly text:string};
export function generateGemini(options: {endpoint:string; accessToken?:string|null; anonKey:string; contents:Content[]; model?:string; systemInstruction?:{parts:{text:string}[]}; onText?:(delta:string,full:string)=>void; onUsage?:(usage:Record<string,unknown>)=>void; onState?:(state:State)=>void; signal?:AbortSignal; timeoutMs?:number; fetchImpl?:typeof fetch}):Promise<Result>;