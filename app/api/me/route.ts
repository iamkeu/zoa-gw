import { NextResponse } from 'next/server';
import { requireUser, authError } from '@/lib/authz';
export async function GET() { try { const { user, profile } = await requireUser(); return NextResponse.json({ data: { id: user.id, email: user.email, display_name: profile.display_name || user.user_metadata?.full_name || user.email, role: profile.role, status: profile.status, provider: user.app_metadata?.provider || 'google' } }); } catch (e) { return authError(e); } }
