import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId, getToken } = await auth()
  const token = await getToken()

  const supabase = await createServerClient()
  const { data, error, count } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({
    clerkUserId: userId,
    hasToken: !!token,
    tokenPrefix: token?.slice(0, 30) + '...',
    supabaseCount: count,
    supabaseError: error?.message ?? null,
  })
}
