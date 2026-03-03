const { createClient } = require("@supabase/supabase-js");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function getOp(event) {
  const url = new URL(event.rawUrl || "http://localhost");
  return url.searchParams.get("op") || "";
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    const op = getOp(event);
    if (!op) return json(400, { error: "Missing op" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { error: "Missing server env vars" });

    const adminAuth = event.headers.authorization || event.headers.Authorization || "";
    const token = adminAuth.startsWith("Bearer ") ? adminAuth.slice(7) : "";
    if (!token) return json(401, { error: "Missing bearer token" });

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { error: "Invalid session" });
    const user = userData.user;

    const { data: adminRow, error: adminErr } = await sb
      .from("crm_admins")
      .select("user_id,email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminErr) return json(500, { error: adminErr.message });
    if (!adminRow) return json(403, { error: "Acesso negado: usuário não é admin (crm_admins)" });

    const payload = event.body ? JSON.parse(event.body) : {};

    if (op === "ping") return json(200, { ok: true, user: { id: user.id, email: user.email } });

    if (op === "patients_list") {
      const q = (payload.q || "").trim();
      let query = sb
        .from("crm_patients")
        .select("user_id,full_name,email,phone,city,birth_date,updated_at")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) return json(500, { error: error.message });
      return json(200, { patients: data || [] });
    }

    if (op === "patient_upsert") {
      const { user_id, full_name, email, phone, city, birth_date } = payload || {};
      if (!user_id || !full_name) return json(400, { error: "user_id e full_name são obrigatórios" });

      const row = {
        user_id,
        full_name,
        email: email || null,
        phone: phone || null,
        city: city || null,
        birth_date: birth_date || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await sb.from("crm_patients").upsert(row, { onConflict: "user_id" }).select().single();
      if (error) return json(500, { error: error.message });
      return json(200, { patient: data });
    }

    if (op === "plans_deactivate") {
      const { user_id } = payload || {};
      if (!user_id) return json(400, { error: "user_id é obrigatório" });
      const { error } = await sb
        .from("crm_plans")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_id", user_id)
        .eq("is_active", true);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    if (op === "plan_get_active") {
      const { user_id } = payload || {};
      if (!user_id) return json(400, { error: "user_id é obrigatório" });

      const { data, error } = await sb
        .from("crm_plans")
        .select("id,user_id,title,content,is_active,updated_at,created_at")
        .eq("user_id", user_id)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return json(500, { error: error.message });
      return json(200, { plan: data || null });
    }

    if (op === "plan_save_active") {
      const { user_id, title, content } = payload || {};
      if (!user_id) return json(400, { error: "user_id é obrigatório" });
      if (!content || typeof content !== "object") return json(400, { error: "content (JSON) é obrigatório" });

      const { error: deErr } = await sb
        .from("crm_plans")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_id", user_id)
        .eq("is_active", true);
      if (deErr) return json(500, { error: deErr.message });

      const { data, error } = await sb
        .from("crm_plans")
        .insert({ user_id, title: title || "Plano", content, is_active: true, updated_at: new Date().toISOString() })
        .select()
        .single();

      if (error) return json(500, { error: error.message });
      return json(200, { plan: data });
    }

    if (op === "diary_get") {
      const { user_id } = payload || {};
      if (!user_id) return json(400, { error: "user_id é obrigatório" });

      const [cl, notes] = await Promise.all([
        sb.from("checklist").select("key,checked,updated_at").eq("user_id", user_id).order("updated_at", { ascending: false }).limit(400),
        sb.from("notes").select("note_id,content,updated_at").eq("user_id", user_id).order("updated_at", { ascending: false }).limit(200),
      ]);
      if (cl.error) return json(500, { error: cl.error.message });
      if (notes.error) return json(500, { error: notes.error.message });
      return json(200, { checklist: cl.data || [], notes: notes.data || [] });
    }

    if (op === "photos_get") {
      const { user_id } = payload || {};
      if (!user_id) return json(400, { error: "user_id é obrigatório" });

      const { data, error } = await sb
        .from("photos")
        .select("photo_key,public_url,week,period,updated_at")
        .eq("user_id", user_id)
        .order("updated_at", { ascending: false })
        .limit(200);

      if (error) return json(500, { error: error.message });
      return json(200, { photos: data || [] });
    }

    return json(400, { error: "Unknown op" });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};
