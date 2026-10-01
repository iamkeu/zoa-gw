'use client';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
export default function LoginPage() {
  const signIn = async () => { const supabase = createSupabaseBrowserClient(); await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } }); };
  return <main style={{maxWidth:420,margin:'12vh auto',padding:32,fontFamily:'sans-serif'}}><p style={{color:'#64748b',fontWeight:700}}>OAVOTE</p><h1>Gửi file và Vote qua Zalo</h1><p style={{color:'#64748b'}}>Đăng nhập bằng tài khoản Google được cấp quyền.</p><button onClick={signIn} style={{padding:'12px 18px',border:0,borderRadius:10,background:'#0f172a',color:'#fff',cursor:'pointer'}}>Tiếp tục với Google</button></main>;
}
