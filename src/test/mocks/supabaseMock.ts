import { vi } from "vitest";

export const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  },
  functions: {
    invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
  storage: {
    from: vi.fn(() => ({
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://mock.url" }, error: null }),
      upload: vi.fn().mockResolvedValue({ data: { path: "mock/path" }, error: null }),
    })),
  },
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn(),
  })),
  removeChannel: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabaseClient,
}));
