import { createClient } from "npm:@supabase/supabase-js@2.39.3";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Only admins can check instance status
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
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

    const globalApiKey = Deno.env.get("EVOLUTION_API_KEY") || "";

    // Use service role to update instances
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch instance(s)
    let query = supabaseAdmin.from("wa_instances").select("*");
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

    console.log(`Checking ${instances.length} instance(s)...`);

    const results = [];

    for (const inst of instances) {
      const apiUrl = inst.evolution_api_url?.replace(/\/$/, "");
      const instanceKey = inst.evolution_instance_key;
      const apiKey = globalApiKey;

      if (!apiUrl || !instanceKey) {
        results.push({
          id: inst.id,
          nome: inst.nome,
          status: "error",
          error: "Missing API URL or instance key",
        });
        continue;
      }

      try {
        // Check connectionState
        const stateUrl = `${apiUrl}/instance/connectionState/${instanceKey}`;
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

          // If 404 instance not found, try fetchInstances to confirm
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

        // Map Evolution state to our status
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

        // Also try to get instance info for phone/profile
        let phoneNumber = inst.phone_number;
        let profileName = inst.profile_name;
        let profilePictureUrl = inst.profile_picture_url;

        if (newStatus === "connected") {
          try {
            const infoUrl = `${apiUrl}/instance/fetchInstances?instanceName=${instanceKey}`;
            const infoRes = await fetch(infoUrl, {
              method: "GET",
              headers: { apikey: apiKey, "Content-Type": "application/json" },
            });
            if (infoRes.ok) {
              const infoData = await infoRes.json();
              // Evolution API returns array or single object
              const instInfo = Array.isArray(infoData) ? infoData[0] : infoData;
              const instData = instInfo?.instance || instInfo;

              phoneNumber = instData?.owner || instData?.wuid?.split("@")?.[0] || phoneNumber;
              profileName = instData?.profileName || profileName;
              profilePictureUrl = instData?.profilePictureUrl || profilePictureUrl;

              // Clean phone number
              if (phoneNumber && phoneNumber.includes("@")) {
                phoneNumber = phoneNumber.split("@")[0];
              }
            }
          } catch (e) {
            console.warn("Error fetching instance info:", e);
          }
        }

        // Update database
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
