'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
export default function LoginPage() {
  const [error, setError] = useState('');
  const signIn = async () => { const supabase = createSupabaseBrowserClient(); const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } }); if (authError) setError(authError.message); };
  return <main style={{maxWidth:420,margin:'12vh auto',padding:32,fontFamily:'sans-serif'}}><p style={{color:'#64748b',fontWeight:700}}>OAVOTE</p><h1>Gửi file và Vote qua Zalo</h1><p style={{color:'#64748b'}}>Đăng nhập bằng tài khoản Google được cấp quyền.</p><button onClick={signIn} style={{padding:'12px 18px',border:0,borderRadius:10,background:'#0f172a',color:'#fff',cursor:'pointer'}}>Tiếp tục với Google</button>{error&&<p role="alert" style={{color:'#b91c1c',marginTop:16}}>Đăng nhập Google chưa được bật. Vui lòng liên hệ quản trị viên.</p>}</main>;
}
