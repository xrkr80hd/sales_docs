export type NativeBrowserState = { depth: number; url?: string; error?: string; dialog?: { id: string; type: string; message: string; defaultPrompt: string; origin: string } | null };
export type NativeBrowser = {
 open: (url: string, accountId: string) => Promise<void>;
 bounds: (rect: { x: number; y: number; width: number; height: number }) => Promise<void>;
 answerDialog: (id: string, accept: boolean, promptText?: string) => Promise<void>;
 back: () => Promise<void>;
 close: () => Promise<void>;
 onState: (listener: (state: NativeBrowserState) => void) => () => void;
};
declare global { interface Window { walkerBrowser?: NativeBrowser; } }
