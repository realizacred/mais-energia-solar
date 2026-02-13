import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Não autorizado");

    // Check super_admin role
    const { data: roles } = await callerClient.from("user_roles").select("role").eq("user_id", caller.id);
    const isSuperAdmin = roles?.some((r: any) => r.role === "super_admin");
    if (!isSuperAdmin) throw new Error("Acesso negado: apenas super_admin");

    const body = await req.json();
    const { nome_empresa, slug, plano_code, admin_email, admin_password, admin_nome } = body;

    if (!nome_empresa || !slug || !admin_email || !admin_password) {
      throw new Error("Campos obrigatórios: nome_empresa, slug, admin_email, admin_password");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Create tenant
    const { data: tenant, error: tenantErr } = await adminClient
      .from("tenants")
      .insert({ nome: nome_empresa, slug, plano: plano_code || "free", ativo: true })
      .select()
      .single();

    if (tenantErr) throw new Error(`Erro ao criar tenant: ${tenantErr.message}`);

    // 2. Create admin user
    const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
    });

    if (authErr) {
      // Rollback tenant
      await adminClient.from("tenants").delete().eq("id", tenant.id);
      throw new Error(`Erro ao criar usuário: ${authErr.message}`);
    }

    const userId = authUser.user.id;

    // 3. Create profile
    const { error: profileErr } = await adminClient.from("profiles").insert({
      user_id: userId,
      nome: admin_nome || admin_email.split("@")[0],
      ativo: true,
      status: "aprovado",
      tenant_id: tenant.id,
    });

    if (profileErr) {
      console.error("Profile error:", profileErr);
    }

    // 4. Assign admin role
    const { error: roleErr } = await adminClient.from("user_roles").insert({
      user_id: userId,
      role: "admin",
      tenant_id: tenant.id,
    });

    if (roleErr) {
      console.error("Role error:", roleErr);
    }

    // 5. Create subscription with selected plan
    const { data: plan } = await adminClient
      .from("plans")
      .select("id")
      .eq("code", plano_code || "free")
      .single();

    if (plan) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 14);

      await adminClient.from("subscriptions").insert({
        tenant_id: tenant.id,
        plan_id: plan.id,
        status: "trialing",
        trial_ends_at: trialEnd.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
      });
    }

    // 6. Create default brand_settings
    await adminClient.from("brand_settings").insert({ tenant_id: tenant.id });

    // 7. Create default calculadora_config
    await adminClient.from("calculadora_config").insert({ tenant_id: tenant.id });

    return new Response(
      JSON.stringify({
        success: true,
        tenant_id: tenant.id,
        user_id: userId,
        message: `Empresa "${nome_empresa}" criada com sucesso!`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
