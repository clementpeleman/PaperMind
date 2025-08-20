import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, paperData } = await request.json();

    if (!prompt || !paperData) {
      return NextResponse.json({ error: 'Missing prompt or paper data' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Construct the system message
    const systemMessage = `You are an AI assistant that analyzes research papers and generates insights based on specific prompts. 
You will be given paper metadata and a specific analysis prompt. Provide a concise, relevant response.`;

    // Construct the user message with paper context
    const paperContext = `
Paper Title: ${paperData.title}
Authors: ${paperData.authors?.join(', ') || 'Unknown'}
Journal/Source: ${paperData.journal || 'Unknown'}
Year: ${paperData.year || 'Unknown'}
Abstract/Notes: ${paperData.notes || 'No abstract available'}
Tags: ${paperData.tags?.join(', ') || 'None'}
DOI: ${paperData.doi || 'Not available'}
Item Type: ${paperData.itemType || 'Unknown'}
`.trim();

    const userMessage = `${paperContext}

Analysis Request: ${prompt}

Please provide a concise analysis (1-3 sentences) based on the paper information above.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ]
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'No content generated' }, { status: 500 });
    }

    return NextResponse.json({ content: content.trim() });

  } catch (error) {
    console.error('Error generating AI content:', error);
    
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json({ 
        error: 'OpenAI API error',
        details: error.message 
      }, { status: error.status || 500 });
    }

    return NextResponse.json({ 
      error: 'Failed to generate content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}