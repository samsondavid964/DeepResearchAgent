// Location: app/api/research/route.ts

import { NextRequest, NextResponse } from 'next/server';
// 1. Correct the import to use 'runResearch'
import { runResearch } from '@/lib/research'; 

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body.query;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required and must be a string' }, { status: 400 });
    }

    // 2. Correct the function call to use 'runResearch'
    const researchResult = await runResearch(query);

    // Return the result
    return NextResponse.json(researchResult);

  } catch (error: any) {
    console.error("An error occurred in the API route:", error);
    return NextResponse.json({ error: 'Failed to complete research.', details: error.message }, { status: 500 });
  }
}
