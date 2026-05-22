import { NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Set a flag to trigger the password recovery mode
      const isRecovery = request.url.includes('type=recovery') || request.url.includes('recovery');
      
      const response = NextResponse.redirect(`${origin}${next}`)
      
      if (isRecovery || next.includes('recovery')) {
         // Optionally set a cookie or just let the client handle it if possible.
         // Wait, the client onAuthStateChange will NOT fire PASSWORD_RECOVERY if we exchange code on the server.
         // Actually, @supabase/ssr might not fire PASSWORD_RECOVERY on the client if exchanged via PKCE.
         // But the `redirect_to` can include a query parameter `?recovery=true`.
         return NextResponse.redirect(`${origin}/?recovery=true`)
      }
      return response
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/?error=auth`)
}
