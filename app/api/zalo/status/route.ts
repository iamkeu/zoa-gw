import { NextResponse } from 'next/server';
import { requireUser, authError } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    await requireUser();
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from('zalo_oa_accounts').select('id,oa_id,oa_name,app_id,connected_at,token_expires_at,is_active,updated_at').eq('is_active', true).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ data: data ? { ...data, token_valid: !data.token_expires_at || new Date(data.token_expires_at).getTime() > Date.now() } : null });
  } catch (e) { return authError(e); }
}
