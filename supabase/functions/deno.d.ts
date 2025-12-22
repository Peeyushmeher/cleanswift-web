// Deno type declarations for Supabase Edge Functions
// These are runtime globals available in Deno but not in Node.js TypeScript

declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
}

// Suppress TypeScript errors for Deno-specific imports
// These work at runtime in Deno but TypeScript doesn't recognize them
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Promise<Response> | Response): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}

declare module 'https://esm.sh/stripe@14.21.0?target=deno' {
  export * from 'stripe';
}

