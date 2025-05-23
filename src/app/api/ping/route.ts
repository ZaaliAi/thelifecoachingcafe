import { NextResponse } from 'next/server';

console.log("--- PING API TEST: /api/ping route.ts TOP LEVEL ---");

export async function GET(request: Request) {
  console.log("--- PING API TEST: GET function in /api/ping CALLED ---");
  return NextResponse.json({ message: "Ping successful!" }, { status: 200 });
}
