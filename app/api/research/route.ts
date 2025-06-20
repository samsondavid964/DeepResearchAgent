import { NextRequest, NextResponse } from 'next/server';
import FirecrawlApp from '@mendable/firecrawl-js';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// --- Initialize your API clients ---

// ** ADD THIS LINE FOR DEBUGGING **
console.log('Firecrawl API Key seen by the server:', process.env.FIRECRAWL_API_KEY);

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required and must be a string' }, { status: 400 });
    }

    console.log(`--- Starting Research for query: "${query}" ---`);

    // --- STEP 1: SEARCH ---
    console.log("-> Step 1: Searching for relevant URLs...");
    const searchResults = await firecrawl.search(query);
    const topResults = searchResults.data.slice(0, 2);
    console.log(`-> Found ${topResults.length} top results to scrape.`);

    // --- STEP 2: SCRAPE (Bypassing the SDK with a direct 'fetch' call) ---
    console.log("-> Step 2: Scraping content from top URLs using direct fetch...");

    const scrapePromises = topResults.map(result => {
      const scrapeUrl = result.url;
      // This fetch call mirrors the successful curl command
      return fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: scrapeUrl }),
      }).then(res => {
        if (!res.ok) {
          // If the response is not OK, we read the error body to understand why
          return res.json().then(errorBody => {
            throw new Error(`API call failed with status ${res.status}: ${JSON.stringify(errorBody)}`);
          });
        }
        return res.json();
      });
    });

    const scrapedData = await Promise.all(scrapePromises);
    console.log("-> Scraping complete.");

    // --- STEP 3: REASON & SYNTHESIZE ---
    const context = scrapedData
      .map((item, index) => {
        if (item.success && item.data) {
          return `--- Scraped Content from ${topResults[index].url} ---\n${item.data.markdown}\n\n`;
        }
        return `--- Could not scrape content from ${topResults[index].url} ---\n\n`;
      })
      .join('');
    
    if (context.trim() === "" || context.includes("Could not scrape content")) {
        console.warn("-> Warning: No content was scraped successfully or some scrapes failed. Proceeding with available data.");
    }

    const researchPrompt = `
      You are a world-class AI research analyst. Your goal is to provide a detailed, well-structured, and factual report based on the user's query and the provided web content.

      User's Query: "${query}"

      Please analyze the following content scraped from the web and synthesize a comprehensive answer. Do not make up information. Base your report solely on the text provided below.

      ${context}

      Your final output should be a detailed report answering the user's query.
    `;
    
    console.log("-> Step 3: Sending content to reasoning model for synthesis...");
    const { text: finalReport } = await generateText({
      model: openai('gpt-4o'),
      prompt: researchPrompt,
    });
    
    console.log("--- Research Complete! ---");

    return NextResponse.json({ success: true, report: finalReport });

  } catch (error: any) {
    console.error("An error occurred during the research process:", error);
    return NextResponse.json({ error: 'Failed to complete research.', details: error.message }, { status: 500 });
  }
} 