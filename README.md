# CRM (Formato A) — Admin HTML + Netlify Function + Supabase

## O que você ganhou
- **admin.html**: painel CRM (login, pacientes, perfil, plano, diário, fotos)
- **netlify/functions/crm.js**: API admin (server-side) com Service Role
- **supabase_schema.sql**: tabelas + RLS

---

## 1) Supabase (Banco)
1. Supabase → SQL Editor
2. Rode `supabase_schema.sql`

Depois:
- Supabase → Auth → Users: crie seu usuário admin (email/senha)
- Copie o `user_id` (uuid) desse usuário
- Rode:

```sql
insert into public.crm_admins (user_id, email) values ('SEU_USER_ID', 'seu@email.com');
```

---

## 2) Netlify (Functions)
Este projeto usa Netlify Functions, então o ideal é **deploy via Git**.

### Variáveis de ambiente (Netlify)
Site settings → Environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

> **Nunca** coloque o service role no frontend.

### Dependência
`package.json` já inclui:
- `@supabase/supabase-js`

---

## 3) Configurar o admin.html
No topo do `admin.html`, ajuste:
- `CONFIG.SUPABASE_URL`
- `CONFIG.SUPABASE_ANON`

---

## 4) Acessar
Abra:
- `https://SEU-SITE.netlify.app/admin.html`

---

## Vínculo paciente ↔ app
O CRM usa `crm_patients.user_id` como chave.
Esse uuid deve ser o mesmo do usuário do paciente no Supabase Auth (o que loga no app da paciente).
