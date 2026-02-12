import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ActivateRequest {
  token: string;
  password: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const { token, password }: ActivateRequest = await req.json();

    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: "Token e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!/[A-Z]/.test(password)) {
      return new Response(
        JSON.stringify({ error: "A senha deve conter pelo menos 1 letra maiúscula" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!/[0-9]/.test(password)) {
      return new Response(
        JSON.stringify({ error: "A senha deve conter pelo menos 1 número" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Look up invite token
    const { data: invite, error: inviteError } = await adminClient
      .from("vendor_invites")
      .select("*, consultores!inner(id, nome, telefone, email, tenant_id)")
      .eq("token", token)
      .is("used_at", null)
      .is("revoked_at", null)
      .single();

    if (inviteError || !invite) {
      console.error("Invite lookup failed:", inviteError?.message);
      return new Response(
        JSON.stringify({ error: "Convite inválido ou já utilizado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Este convite expirou. Solicite um novo ao administrador." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vendedor = invite.consultores;
    const email = invite.email;
    const tenantId = invite.tenant_id;

    // Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome: vendedor.nome },
    });

    if (createError) {
      console.error("User creation error:", createError.message);
      return new Response(
        JSON.stringify({ error: `Erro ao criar conta: ${createError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: "Falha ao criar usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user.id;
    console.log("User created:", userId);

    // Create profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .insert({
        user_id: userId,
        nome: vendedor.nome,
        tenant_id: tenantId,
        status: "ativo",
      });

    if (profileError) {
      console.error("Profile creation error:", profileError.message);
    }

    // Assign consultor role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "consultor",
        tenant_id: tenantId,
      });

    if (roleError) {
      console.error("Role assignment error:", roleError.message);
    }

    // Link user_id to consultor
    const { error: linkError } = await adminClient
      .from("consultores")
      .update({ user_id: userId })
      .eq("id", vendedor.id);

    if (linkError) {
      console.error("Consultor link error:", linkError.message);
    }

    // Mark invite as used
    const { error: usedError } = await adminClient
      .from("vendor_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (usedError) {
      console.error("Invite update error:", usedError.message);
    }

    // Sign in the user to generate a session
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error("Auto sign-in error:", signInError.message);
      // User was created but auto-login failed - they can login manually
      return new Response(
        JSON.stringify({
          success: true,
          user_id: userId,
          auto_login: false,
          message: "Conta ativada! Faça login com seu email e senha.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Account activated and signed in:", userId);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        auto_login: true,
        session: {
          access_token: signInData.session?.access_token,
          refresh_token: signInData.session?.refresh_token,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error activating account:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
