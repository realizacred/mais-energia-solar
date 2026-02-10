import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateUserRequest {
  email: string;
  password: string;
  nome: string;
  role?: "admin" | "gerente" | "vendedor" | "instalador" | "financeiro";
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the requesting user is authenticated and is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // IMPORTANT: In edge runtime there is no session storage; pass the JWT explicitly.
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      console.error("Empty bearer token");
      return new Response(
        JSON.stringify({ error: "Unauthorized: Empty token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate JWT using getClaims (doesn't depend on server session)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("Token validation failed:", claimsError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestingUserId = claimsData.claims.sub as string;
    console.log("Authenticated user:", requestingUserId);

    // Check if requesting user has admin role
    const { data: hasAdminRole, error: roleError } = await userClient.rpc("has_role", {
      _user_id: requestingUserId,
      _role: "admin",
    });

    if (roleError) {
      console.error("Role check error:", roleError.message);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!hasAdminRole) {
      console.error("User is not admin:", requestingUserId);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve tenant_id from requesting admin's profile
    const { data: adminProfile } = await userClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", requestingUserId)
      .maybeSingle();

    const tenantId = adminProfile?.tenant_id || null;
    console.log("Resolved tenant_id:", tenantId);

    // Parse request body
    const { email, password, nome, role = "vendedor" }: CreateUserRequest = await req.json();

    if (!email || !password || !nome) {
      return new Response(
        JSON.stringify({ error: "Email, password and nome are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role
    const validRoles = ["admin", "gerente", "vendedor", "instalador", "financeiro"];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role: ${role}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create the user using Admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { nome },
    });

    if (createError) {
      console.error("User creation error:", createError.message);
      return new Response(
        JSON.stringify({ error: `Failed to create user: ${createError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: "User creation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User created:", newUser.user.id);

    // Create profile for the new user
    const { error: profileError } = await adminClient
      .from("profiles")
      .insert({
        user_id: newUser.user.id,
        nome,
        tenant_id: tenantId,
      });

    if (profileError) {
      console.error("Profile creation error:", profileError.message);
      // Don't fail - profile can be created later
    }

    // Assign role to the new user
    const { error: roleAssignError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: role,
        created_by: requestingUserId,
        tenant_id: tenantId,
      });

    if (roleAssignError) {
      console.error("Role assignment error:", roleAssignError.message);
      // Don't fail - role can be assigned later
    }

    console.log(`User created successfully: ${newUser.user.id} with role: ${role}`);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.user.id,
        email: newUser.user.email,
        role: role,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error creating user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
