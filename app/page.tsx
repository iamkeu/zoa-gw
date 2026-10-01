import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main style={{maxWidth:720,margin:'12vh auto',padding:32,fontFamily:'sans-serif'}}><p style={{color:'#64748b',fontWeight:700}}>OAVOTE</p><h1>Gửi file + Vote tới Zalo UID</h1><p>Ứng dụng vận hành trên Vercel, xác thực Google và lưu dữ liệu trên Supabase.</p><Link href="/login">Đăng nhập bằng Google</Link></main>;
  return <main style={{maxWidth:1000,margin:'5vh auto',padding:32,fontFamily:'sans-serif'}}><p style={{color:'#64748b',fontWeight:700}}>OAVOTE / DASHBOARD</p><h1>Gửi file và Vote</h1><p style={{color:'#64748b'}}>Xin chào {user.user_metadata?.full_name || user.email}. Chọn tác vụ để bắt đầu.</p><section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16,marginTop:28}}>{[['/send','Gửi file + Vote','Upload file, chọn UID và template'],['/transactions','Nhật ký giao dịch','Theo dõi trạng thái và retry'],['/templates','Template Vote','Xem template đã được cấu hình'],['/settings','Cấu hình','Kết nối OA và phân quyền']].map(([href,title,desc])=><Link key={href} href={href} style={{padding:20,border:'1px solid #e2e8f0',borderRadius:14,textDecoration:'none',color:'#0f172a'}}><b>{title}</b><p style={{color:'#64748b',marginBottom:0}}>{desc}</p></Link>)}</section></main>;
}
