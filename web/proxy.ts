import { NextRequest, NextResponse } from "next/server"
import { updateSession } from "./lib/proxy"
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  // Only allow admins to access the admin panel
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // needs its own client since cookies() from next/headers isn't available here
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {}, // no-op, updateSession already handles cookie setting
        }
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data } = await supabase
      .from('User')
      .select('role')
      .eq('id', user.id)
      .single()

    if (data?.role !== 'admin') {
      return new NextResponse(null, { status: 403 })
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}