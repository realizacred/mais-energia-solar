import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getPublicUrl } from "@/lib/getPublicUrl";
import { useTenantGuard, type TenantGuardStatus } from "@/hooks/useTenantGuard";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  tenantStatus: TenantGuardStatus;
  tenantGuard: {
    tenantName?: string;
    suspendedAt?: string | null;
    suspendedReason?: string | null;
  };
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ⚠️ HARDENING: No polling for auth access checks. Realtime only.
// Never combine polling + realtime on the same resource.

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const tenantGuardState = useTenantGuard(user?.id);

  const signOut = useCallback(async (reason?: string) => {
    if (reason) {
      sessionStorage.setItem("logout_reason", reason);
    }
    await supabase.auth.signOut();
  }, []);

  // Realtime: listen for profile deactivation AND role removal
  useEffect(() => {
    if (!user) return;

    const profileChannel = supabase
      .channel(`profile-access-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new && (payload.new as any).ativo === false) {
            console.warn("[auth] Profile deactivated via realtime, signing out");
            signOut("Seu acesso foi desativado. Entre em contato com o administrador.");
          }
        }
      )
      .subscribe();

    const rolesChannel = supabase
      .channel(`roles-access-${user.id}`)
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        async () => {
          // Verify no roles remain before signing out
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          if (!roles || roles.length === 0) {
            console.warn("[auth] All roles removed via realtime, signing out");
            await signOut("Seus perfis de acesso foram removidos. Entre em contato com o administrador.");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(rolesChannel);
    };
  }, [user, signOut]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${getPublicUrl()}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    // Supabase returns 200 with empty identities for existing emails (anti-enumeration)
    if (!error && data?.user && (!data.user.identities || data.user.identities.length === 0)) {
      return { error: new Error("User already registered") as Error | null };
    }

    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      tenantStatus: tenantGuardState.status,
      tenantGuard: {
        tenantName: tenantGuardState.tenantName,
        suspendedAt: tenantGuardState.suspendedAt,
        suspendedReason: tenantGuardState.suspendedReason,
      },
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
