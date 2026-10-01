import { NextResponse } from 'next/server';
import { requireUser, authError } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getOAProfile } from '@/lib/zalo/client';

export async function GET() {
  try {
    await requireUser();
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from('zalo_oa_accounts').select('id,oa_id,oa_name,app_id,connected_at,token_expires_at,is_active,updated_at').eq('is_active', true).maybeSingle();
    if (error) throw error;
    if (data && !data.oa_name) { try { const remote = await getOAProfile(data.id); const name = remote.data?.name || remote.data?.oa_name || remote.name || null; if (name) { await db.from('zalo_oa_accounts').update({ oa_name: name, updated_at: new Date().toISOString() }).eq('id', data.id); data.oa_name = name; } } catch {} }
    return NextResponse.json({ data: data ? { ...data, token_valid: !data.token_expires_at || new Date(data.token_expires_at).getTime() > Date.now() } : null });
  } catch (e) { return authError(e); }
}
