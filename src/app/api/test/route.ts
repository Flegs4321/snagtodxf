import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'Snap2DXF API is working!',
    endpoints: {
      convert: 'POST /api/convert',
      health: 'GET /api/health',
      test: 'GET /api/test'
    },
    features: [
      'PNG/JPEG to DXF conversion',
      'Adjustable threshold and simplification',
      'Optional Supabase cloud storage',
      'Mobile-friendly drag & drop interface'
    ]
  })
}
