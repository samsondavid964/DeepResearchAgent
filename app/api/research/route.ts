// Location: app/api/research/route.ts

import { NextRequest, NextResponse } from 'next/server';
// This import now correctly matches the function exported from research.ts
import { runComprehensiveResearch } from '@/lib/research'; 

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body.query;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required and must be a string' }, { status: 400 });
    }

    // Call the centralized, advanced research function
    const researchResult = await runComprehensiveResearch(query);

    // Return the result
    return NextResponse.json(researchResult);

  } catch (error: any) {
    console.error("An error occurred in the API route:", error);
    return NextResponse.json({ error: 'Failed to complete research.', details: error.message }, { status: 500 });
  }
}
