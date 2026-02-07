import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user has admin role
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Check if user has admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Instagram config using service role for reading config
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: config, error: configError } = await supabaseAdmin
      .from("instagram_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      console.error("Config error:", configError);
      return new Response(
        JSON.stringify({ success: false, error: "Instagram not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Access token not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching Instagram media...");

    // Fetch media from Instagram Graph API
    const instagramUrl = `https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp&access_token=${config.access_token}&limit=12`;
    
    const instagramResponse = await fetch(instagramUrl);
    const instagramData = await instagramResponse.json();

    if (instagramData.error) {
      console.error("Instagram API error:", instagramData.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: instagramData.error.message || "Instagram API error" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const media = instagramData.data || [];
    console.log(`Found ${media.length} media items`);

    // Clear existing posts and insert new ones
    await supabaseAdmin.from("instagram_posts").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const postsToInsert = media.map((item: any) => ({
      instagram_id: item.id,
      media_type: item.media_type,
      media_url: item.media_url,
      thumbnail_url: item.thumbnail_url || null,
      permalink: item.permalink,
      caption: item.caption || null,
      timestamp: item.timestamp,
    }));

    if (postsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("instagram_posts")
        .insert(postsToInsert);

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }
    }

    // Update last sync time
    await supabaseAdmin
      .from("instagram_config")
      .update({ ultima_sincronizacao: new Date().toISOString() })
      .eq("id", config.id);

    console.log(`Successfully synced ${postsToInsert.length} posts`);

    return new Response(
      JSON.stringify({ success: true, count: postsToInsert.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
