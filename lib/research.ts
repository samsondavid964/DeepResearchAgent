// Location: lib/research.ts

import FirecrawlApp from '@mendable/firecrawl-js';
import { generateText, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY || '' });
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function runComprehensiveResearch(initialQuery: string) {
  try {
    // STEP 1: AI creates a research plan
    console.log("-> Step 1: Deconstructing prompt and forming a research plan...");
    const { toolResults } = await generateText({
      model: openai('gpt-4o'),
      system: 'You are a research planning assistant. Your job is to break down a user query into a structured research plan.',
      prompt: `Based on the user's query, identify the primary company/entity and create a list of specific Google search queries to find all the requested information. The user's query is: "${initialQuery}"`,
      tools: {
        createResearchPlan: tool({
          description: 'Create a research plan with a primary domain and a list of search queries.',
          parameters: z.object({
            primaryDomain: z.string().describe('The main website of the company. E.g., cars45.com'),
            searchQueries: z.array(z.string()).describe('A list of targeted Google search queries to find the required information.'),
          }),
          execute: async ({ primaryDomain, searchQueries }) => ({ primaryDomain, searchQueries }),
        }),
      },
    });

    const { primaryDomain, searchQueries } = toolResults[0].result;
    let accumulatedContent = "";

    // STEP 2: Scrape the primary website using the reliable fetch method
    console.log(`-> Step 2: Scraping primary domain: ${primaryDomain}...`);
    try {
      const mainSiteResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: `https://${primaryDomain}/` }),
      }).then(res => res.json());

      if (mainSiteResponse.success) {
        accumulatedContent += `--- Content from https://${primaryDomain}/ ---\n${mainSiteResponse.data.markdown.substring(0, 15000)}\n\n`;
      }
    } catch (e) {
      console.error(`Failed to scrape primary domain ${primaryDomain}:`, e);
    }

    // STEP 3 & 4: Iterative Google Search and Scrape using the reliable fetch method
    console.log("-> Step 3 & 4: Executing targeted Google searches and scraping results...");
    for (const query of searchQueries) {
      console.log(`--> Searching for: "${query}"`);
      const searchResults = await firecrawl.search(query);
      const topResult = searchResults.data.slice(0, 1)[0];

      if (topResult) {
        console.log(`--> Scraping top result: ${topResult.url}`);
        try {
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: topResult.url }),
          }).then(res => res.json());

          if (scrapeResponse.success) {
            accumulatedContent += `--- Content from search query "${query}" (${topResult.url}) ---\n${scrapeResponse.data.markdown.substring(0, 8000)}\n\n`;
          }
        } catch (e) {
          console.error(`Failed to scrape ${topResult.url}:`, e);
        }
      }
    }

    // STEP 5: Final Synthesis
    console.log("-> Step 5: Synthesizing final report from all gathered content...");
    const finalReportPrompt = `
      You are a world-class business analyst. Your task is to generate a detailed, structured report based on the user's original request and a collection of scraped text from multiple web pages.
      Original User Request: "${initialQuery}"
      Synthesize all the information from the context provided below into a single, well-organized report. Extract specific facts like founded year, headquarters, key people, and financial data if present. For news articles, summarize the title, date, and content. If a piece of information is not present in the context, state that it was not found. Do not make up information.
      --- Accumulated Web Content ---
      ${accumulatedContent}
    `;

    const { text: finalReport } = await generateText({ model: openai('gpt-4o'), prompt: finalReportPrompt });

    return { success: true, report: finalReport };
  } catch (error: any) {
    console.error("An error occurred during the comprehensive research process:", error);
    return { success: false, error: 'Failed to complete research.', details: error.message };
  }
}
