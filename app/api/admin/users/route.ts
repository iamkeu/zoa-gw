import { NextRequest, NextResponse } from 'next/server';
import { requireUser, authError, type AppRole } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const roles: AppRole[] = ['admin', 'operator', 'viewer'];
const statuses = ['pending', 'active', 'suspended'] as const;

export async function GET() {
  try { await requireUser(['admin']); const db = createSupabaseAdminClient(); const { data, error } = await db.from('user_profiles').select('id,email,display_name,role,status,created_at,updated_at').order('created_at', { ascending: false }); if (error) throw error; return NextResponse.json({ data: data || [] }); } catch (e) { return authError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const { profile: actor } = await requireUser(['admin']); const body = await req.json(); const email = String(body.email || '').trim().toLowerCase(); const displayName = String(body.display_name || '').trim(); const role = body.role as AppRole; const status = (body.status || 'active') as typeof statuses[number];
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Email không hợp lệ' } }, { status: 400 });
    if (!roles.includes(role) || !statuses.includes(status)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Role hoặc trạng thái không hợp lệ' } }, { status: 400 });
    const db = createSupabaseAdminClient(); const { data: created, error: createError } = await db.auth.admin.createUser({ email, email_confirm: false, user_metadata: { full_name: displayName || email.split('@')[0] } });
    if (createError || !created.user) { if (createError?.message?.toLowerCase().includes('already')) return NextResponse.json({ error: { code: 'DUPLICATE_EMAIL', message: 'Email đã tồn tại trong hệ thống' } }, { status: 409 }); throw createError || new Error('USER_CREATE_FAILED'); }
    const { data, error } = await db.from('user_profiles').insert({ id: created.user.id, email, display_name: displayName || email.split('@')[0], role, status }).select('id,email,display_name,role,status,created_at,updated_at').single(); if (error) { await db.auth.admin.deleteUser(created.user.id); throw error; }
    await db.from('audit_logs').insert({ actor_id: actor.id, action: 'user.created', entity_type: 'user_profiles', entity_id: data.id, metadata: { email, role, status } }); return NextResponse.json({ data }, { status: 201 });
  } catch (e) { return authError(e); }
}
