// REVE CRM · Netlify Function
const { createClient } = require("@supabase/supabase-js");
const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type, authorization","Access-Control-Allow-Methods":"POST, OPTIONS"};
function json(body,status=200){return{statusCode:status,headers:{...CORS,"Content-Type":"application/json"},body:JSON.stringify(body)};}
function err(msg,status=400){return json({error:msg},status);}
async function assertAdmin(sb,authHeader){if(!authHeader?.startsWith("Bearer "))throw new Error("Token ausente");const token=authHeader.slice(7);const{data:{user},error}=await sb.auth.getUser(token);if(error||!user)throw new Error("Token inválido");const{data:admin}=await sb.from("crm_admins").select("user_id").eq("user_id",user.id).maybeSingle();if(!admin)throw new Error("Acesso negado");return user;}
exports.handler=async(event)=>{
if(event.httpMethod==="OPTIONS")return{statusCode:204,headers:CORS,body:""};
if(event.httpMethod!=="POST")return err("Método não permitido",405);
const SUPABASE_URL=process.env.SUPABASE_URL;const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!SUPABASE_URL||!SERVICE_KEY)return err("Env vars não configuradas",500);
const sb=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false}});
const op=event.queryStringParameters?.op||"";const body=JSON.parse(event.body||"{}");const auth=event.headers?.authorization;
try{
if(op==="ping"){await assertAdmin(sb,auth);return json({ok:true});}
if(op==="patients_list"){await assertAdmin(sb,auth);const q=body.q||"";let query=sb.from("crm_patients").select("*").order("full_name");if(q)query=query.or("full_name.ilike.%"+q+"%,email.ilike.%"+q+"%");const{data,error}=await query;if(error)throw error;return json({patients:data});}
if(op==="patient_upsert"){await assertAdmin(sb,auth);const{user_id,full_name,email,phone,city,birth_date}=body;if(!user_id||!full_name)return err("user_id e full_name obrigatórios");const{error}=await sb.from("crm_patients").upsert({user_id,full_name,email,phone,city,birth_date:birth_date||null,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)throw error;return json({ok:true});}
if(op==="plan_get_active"){await assertAdmin(sb,auth);const{user_id}=body;if(!user_id)return err("user_id obrigatório");const{data,error}=await sb.from("crm_plans").select("*").eq("user_id",user_id).eq("is_active",true).order("created_at",{ascending:false}).limit(1).maybeSingle();if(error)throw error;return json({plan:data});}
if(op==="plan_save_active"){await assertAdmin(sb,auth);const{user_id,title,content}=body;if(!user_id)return err("user_id obrigatório");await sb.from("crm_plans").update({is_active:false}).eq("user_id",user_id);const{error}=await sb.from("crm_plans").insert({user_id,title:title||"Plano",content:content||{},is_active:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});if(error)throw error;return json({ok:true});}
if(op==="plans_deactivate"){await assertAdmin(sb,auth);const{user_id}=body;if(!user_id)return err("user_id obrigatório");const{error}=await sb.from("crm_plans").update({is_active:false}).eq("user_id",user_id);if(error)throw error;return json({ok:true});}
if(op==="diary_get"){await assertAdmin(sb,auth);const{user_id}=body;if(!user_id)return err("user_id obrigatório");const[cl,notes]=await Promise.all([sb.from("checklist").select("*").eq("user_id",user_id).order("key"),sb.from("notes").select("*").eq("user_id",user_id).order("note_id")]);if(cl.error)throw cl.error;if(notes.error)throw notes.error;return json({checklist:cl.data,notes:notes.data});}
if(op==="photos_get"){await assertAdmin(sb,auth);const{user_id}=body;if(!user_id)return err("user_id obrigatório");const{data,error}=await sb.from("photos").select("*").eq("user_id",user_id).order("updated_at",{ascending:false});if(error)throw error;return json({photos:data});}
return err("op desconhecida: "+op,404);
}catch(e){console.error("[crm]",e);return err(e.message||"Erro interno",500);}
};
