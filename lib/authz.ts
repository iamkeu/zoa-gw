import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
export type AppRole = 'admin' | 'operator' | 'viewer';
export async function requireUser(roles?: AppRole[]) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  const { data: profile } = await createSupabaseAdminClient().from('user_profiles').select('id,email,display_name,role,status').eq('id', user.id).single();
  if (!profile || profile.status !== 'active') throw new Error('FORBIDDEN');
  if (roles && !roles.includes(profile.role) && profile.role !== 'admin') throw new Error('FORBIDDEN');
  return { user, profile, supabase };
}
export function authError(error: unknown) {
  const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  if (message === 'UNAUTHENTICATED') return Response.json({ error: { code: 'UNAUTHENTICATED', message: 'Đăng nhập để tiếp tục' } }, { status: 401 });
  if (message === 'FORBIDDEN') return Response.json({ error: { code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này' } }, { status: 403 });
  return Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Có lỗi hệ thống' } }, { status: 500 });
}
