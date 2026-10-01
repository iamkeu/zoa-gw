import { NextResponse } from 'next/server';
import { requireUser, authError } from '@/lib/authz';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
export async function GET() { try { await requireUser(); const { data, error } = await createSupabaseAdminClient().from('rating_templates').select('id,oa_account_id,template_id,name,parameters,default_values,is_active,created_at,updated_at').order('name'); if (error) throw error; return NextResponse.json({ data: data || [] }); } catch (e) { return authError(e); } }
