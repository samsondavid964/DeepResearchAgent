import FirecrawlApp from '@mendable/firecrawl-js';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY || '',
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function runResearch(query: string, limit = 3) {
  // --- STEP 1: SEARCH ---
  const searchResults = await firecrawl.search(query, {
    pageOptions: { fetchPageContent: false }
  });
  const topResults = searchResults.data.slice(0, limit);

  // --- STEP 2: SCRAPE ---
  const scrapePromises = topResults.map(result =>
    firecrawl.scrape({ url: result.url, pageOptions: { onlyMainContent: true } })
  );
  const scrapedData = await Promise.all(scrapePromises);

  // --- STEP 3: REASON & SYNTHESIZE ---
  const context = scrapedData
    .map((item, index) => `--- Scraped Content from ${topResults[index].url} ---\n${item.data.markdown}\n\n`)
    .join('');

  const researchPrompt = `
    You are a world-class AI research analyst. Your goal is to provide a detailed, well-structured, and factual report based on the user's query and the provided web content.

    User's Query: "${query}"

    Please analyze the following content scraped from the web and synthesize a comprehensive answer. Do not make up information. Base your report solely on the text provided below.

    ${context}

    Your final output should be a detailed report answering the user's query.
  `;

  const { text: finalReport } = await generateText({
    model: openai('gpt-4o'),
    prompt: researchPrompt,
  });

  return { success: true, report: finalReport };
} 