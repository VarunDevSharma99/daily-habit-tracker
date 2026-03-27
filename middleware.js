import { NextResponse } from 'next/server';

// Paths that should NOT require PIN auth
const PUBLIC_PATHS = [
  '/api/telegram/',
  '/api/cron/',
  '/api/auth',
  '/login',
  '/_next/',
  '/favicon.ico',
];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get('life_score_auth');

  if (authCookie?.value === 'authenticated') {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
