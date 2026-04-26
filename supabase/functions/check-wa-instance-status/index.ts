import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildContext, fetchConnectionState, logoutRequest } from "../_shared/wa-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate user session
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profile with tenant_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "Tenant not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Role check: only admin or gerente
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "gerente"])
      .limit(1)
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ success: false, error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const instanceId = body.instance_id || null;
    const action = body.action || "check"; // "check" | "logout"

    // Fetch instance(s) with tenant isolation
    let query = supabaseAdmin
      .from("wa_instances")
      .select("*")
      .eq("tenant_id", profile.tenant_id);
    if (instanceId) {
      query = query.eq("id", instanceId);
    }
    const { data: instances, error: fetchError } = await query;

    if (fetchError || !instances || instances.length === 0) {
      console.error("Error fetching instances:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "No instances found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── ACTION: LOGOUT ──
    if (action === "logout" && instanceId && instances.length === 1) {
      const inst = instances[0];
      const apiUrl = inst.evolution_api_url?.replace(/\/$/, "");
      const instanceKey = inst.evolution_instance_key;
      const apiKey = inst.api_key;

      if (!apiUrl || !instanceKey || !apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "Configuração incompleta da instância (URL, key ou API key ausente)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const encodedKey = encodeURIComponent(instanceKey);
        const logoutUrl = `${apiUrl}/instance/logout/${encodedKey}`;

        const logoutRes = await fetch(logoutUrl, {
          method: "DELETE",
          headers: { apikey: apiKey, "Content-Type": "application/json" },
        });

        const logoutText = await logoutRes.text();

        // Update status to disconnected regardless (Evolution may return 404 if already disconnected)
        await supabaseAdmin
          .from("wa_instances")
          .update({ status: "disconnected", updated_at: new Date().toISOString() })
          .eq("id", inst.id);

        if (!logoutRes.ok && logoutRes.status !== 404) {
          console.error(`[check-wa-instance-status] Logout error for ${instanceKey}:`, logoutRes.status, logoutText);
          return new Response(
            JSON.stringify({
              success: true,
              status: "disconnected",
              warning: `API retornou ${logoutRes.status} mas instância foi marcada como desconectada`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, status: "disconnected", message: `Instância "${inst.nome}" desconectada com sucesso` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        console.error(`[check-wa-instance-status] Logout exception for ${inst.nome}:`, err);
        // Still mark as disconnected locally
        await supabaseAdmin
          .from("wa_instances")
          .update({ status: "disconnected", updated_at: new Date().toISOString() })
          .eq("id", inst.id);

        return new Response(
          JSON.stringify({
            success: true,
            status: "disconnected",
            warning: `Erro ao comunicar com Evolution API, mas instância marcada como desconectada: ${err.message}`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`[check-wa-instance-status] Checking ${instances.length} instance(s) for tenant ${profile.tenant_id}`);

    const results = [];

    for (const inst of instances) {
      const apiUrl = inst.evolution_api_url?.replace(/\/$/, "");
      const instanceKey = inst.evolution_instance_key;
      const apiKey = inst.api_key;

      if (!apiUrl || !instanceKey || !apiKey) {
        results.push({
          id: inst.id,
          nome: inst.nome,
          status: "error",
          error: "Missing API URL, instance key, or API key",
        });
        continue;
      }

      try {
        const encodedKey = encodeURIComponent(instanceKey);
        const stateUrl = `${apiUrl}/instance/connectionState/${encodedKey}`;
        console.log(`Checking: ${stateUrl}`);

        const stateRes = await fetch(stateUrl, {
          method: "GET",
          headers: {
            apikey: apiKey,
            "Content-Type": "application/json",
          },
        });

        if (!stateRes.ok) {
          const errText = await stateRes.text();
          console.error(`connectionState error for ${instanceKey}:`, stateRes.status, errText);

          let newStatus = "error" as string;
          if (stateRes.status === 404 || stateRes.status === 400) {
            newStatus = "disconnected";
          }

          await supabaseAdmin
            .from("wa_instances")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("id", inst.id);

          results.push({
            id: inst.id,
            nome: inst.nome,
            status: newStatus,
            error: `API returned ${stateRes.status}`,
          });
          continue;
        }

        const stateJson = await stateRes.json();
        const connectionState = stateJson?.instance?.state || stateJson?.state || "unknown";
        console.log(`Instance ${instanceKey} state:`, connectionState);

        let newStatus: string;
        switch (connectionState) {
          case "open":
            newStatus = "connected";
            break;
          case "connecting":
            newStatus = "connecting";
            break;
          case "close":
          case "closed":
            newStatus = "disconnected";
            break;
          default:
            newStatus = "disconnected";
        }

        // Fetch instance info if connected
        let phoneNumber = inst.phone_number;
        let profileName = inst.profile_name;
        let profilePictureUrl = inst.profile_picture_url;

        if (newStatus === "connected") {
          try {
            const encodedKeyInfo = encodeURIComponent(instanceKey);
            const infoUrl = `${apiUrl}/instance/fetchInstances?instanceName=${encodedKeyInfo}`;
            const infoRes = await fetch(infoUrl, {
              method: "GET",
              headers: { apikey: apiKey, "Content-Type": "application/json" },
            });
            if (infoRes.ok) {
              const infoData = await infoRes.json();
              const instInfo = Array.isArray(infoData) ? infoData[0] : infoData;
              const instData = instInfo?.instance || instInfo;

              phoneNumber = instData?.owner || instData?.wuid?.split("@")?.[0] || phoneNumber;
              profileName = instData?.profileName || profileName;
              profilePictureUrl = instData?.profilePictureUrl || profilePictureUrl;

              if (phoneNumber && phoneNumber.includes("@")) {
                phoneNumber = phoneNumber.split("@")[0];
              }
            }
          } catch (e) {
            console.warn("Error fetching instance info:", e);
          }
        }

        await supabaseAdmin
          .from("wa_instances")
          .update({
            status: newStatus,
            phone_number: phoneNumber,
            profile_name: profileName,
            profile_picture_url: profilePictureUrl,
            last_seen_at: newStatus === "connected" ? new Date().toISOString() : inst.last_seen_at,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inst.id);

        results.push({
          id: inst.id,
          nome: inst.nome,
          status: newStatus,
          phone_number: phoneNumber,
          profile_name: profileName,
          connectionState,
        });
      } catch (err: any) {
        console.error(`Error checking instance ${instanceKey}:`, err);

        await supabaseAdmin
          .from("wa_instances")
          .update({ status: "error", updated_at: new Date().toISOString() })
          .eq("id", inst.id);

        results.push({
          id: inst.id,
          nome: inst.nome,
          status: "error",
          error: err.message || String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-wa-instance-status:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
