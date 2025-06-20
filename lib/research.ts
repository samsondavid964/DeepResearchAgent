import FirecrawlApp from '@mendable/firecrawl-js';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Initialize clients once
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY || '',
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// The main research function, now using the correct fetch logic
export async function runResearch(query: string) {
  // --- STEP 1: SEARCH ---
  console.log("-> [Research Lib] Step 1: Searching for relevant URLs...");
  const searchResults = await firecrawl.search(query);
  const topResults = searchResults.data.slice(0, 2); // Using 2 results as a safe limit
  console.log(`-> [Research Lib] Found ${topResults.length} top results to scrape.`);

  // --- STEP 2: SCRAPE (Using the direct fetch call that we know works) ---
  console.log("-> [Research Lib] Step 2: Scraping content from top URLs using direct fetch...");
  const scrapePromises = topResults.map(result => {
    const scrapeUrl = result.url;
    return fetch('https://api.firecrawl.dev/v0/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: scrapeUrl }),
    }).then(res => {
      if (!res.ok) {
        return res.json().then(errorBody => {
          throw new Error(`API call failed with status ${res.status}: ${JSON.stringify(errorBody)}`);
        });
      }
      return res.json();
    });
  });
  const scrapedData = await Promise.all(scrapePromises);
  console.log("-> [Research Lib] Scraping complete.");

  // --- STEP 3: REASON & SYNTHESIZE ---
  console.log("-> [Research Lib] Step 3: Sending content to reasoning model for synthesis...");
  const context = scrapedData
    .map((item, index) => {
      if (item.success && item.data) {
        return `--- Scraped Content from ${topResults[index].url} ---\n${item.data.markdown}\n\n`;
      }
      return `--- Could not scrape content from ${topResults[index].url} ---\n\n`;
    })
    .join('');

  const researchPrompt = `
    You are a world-class AI research analyst.
    User's Query: "${query}"
    Please analyze the following content scraped from the web and synthesize a comprehensive report.
    ${context}
    Your final output should be a detailed report answering the user's query.
  `;
  
  const { text: finalReport } = await generateText({
    model: openai('gpt-4o'),
    prompt: researchPrompt,
  });

  console.log("-> [Research Lib] Research Complete!");
  return { success: true, report: finalReport };
}
