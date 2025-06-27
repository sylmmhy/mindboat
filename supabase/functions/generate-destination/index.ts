import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DestinationRequest {
  task: string;
  userId: string;
}

interface DestinationResponse {
  destination_name: string;
  description: string;
  related_apps: string[];
  color_theme: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { task, userId }: DestinationRequest = await req.json();

    if (!task || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For now, we'll use a simple transformation algorithm
    // In production, this would call OpenAI or another LLM service
    const destination = generateDestinationFallback(task);

    return new Response(
      JSON.stringify(destination),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error generating destination:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function generateDestinationFallback(task: string): DestinationResponse {
  const taskLower = task.toLowerCase();
  
  // Simple keyword-based destination generation
  let destinationName = '';
  let description = '';
  let relatedApps: string[] = [];
  let colorTheme = '#3B82F6';

  if (taskLower.includes('thesis') || taskLower.includes('research') || taskLower.includes('paper') || taskLower.includes('study')) {
    destinationName = 'Academic Archipelago';
    description = 'Navigate the seas of knowledge where every page is a pathway to wisdom.';
    relatedApps = ['Zotero', 'Notion', 'Word', 'Google Scholar', 'Mendeley'];
    colorTheme = '#8B5CF6';
  } else if (taskLower.includes('code') || taskLower.includes('programming') || taskLower.includes('develop') || taskLower.includes('build')) {
    destinationName = 'Code Cove';
    description = 'Where logic meets creativity to build digital wonders.';
    relatedApps = ['VS Code', 'GitHub', 'Terminal', 'Stack Overflow', 'Docker'];
    colorTheme = '#10B981';
  } else if (taskLower.includes('piano') || taskLower.includes('music') || taskLower.includes('instrument')) {
    destinationName = 'Melody Marina';
    description = 'Let your fingers dance on keys, creating symphonies from the heart.';
    relatedApps = ['Simply Piano', 'Flowkey', 'YouTube', 'Metronome', 'MuseScore'];
    colorTheme = '#F59E0B';
  } else if (taskLower.includes('fitness') || taskLower.includes('exercise') || taskLower.includes('workout') || taskLower.includes('gym')) {
    destinationName = 'Strength Summit';
    description = 'Climb the peaks of physical and mental fortitude through dedicated training.';
    relatedApps = ['Nike Training', 'MyFitnessPal', 'Strava', 'Apple Health', 'YouTube'];
    colorTheme = '#EF4444';
  } else if (taskLower.includes('learn') || taskLower.includes('course') || taskLower.includes('education')) {
    destinationName = 'Wisdom Waters';
    description = 'Sail through islands of knowledge where every discovery opens new horizons.';
    relatedApps = ['Anki', 'Notion', 'Khan Academy', 'Coursera', 'YouTube'];
    colorTheme = '#6366F1';
  } else if (taskLower.includes('write') || taskLower.includes('writing') || taskLower.includes('article') || taskLower.includes('blog')) {
    destinationName = 'Writers Bay';
    description = 'Where thoughts flow like tides and every sentence sparkles with purpose.';
    relatedApps = ['Notion', 'Typora', 'Grammarly', 'Hemingway Editor', 'Google Docs'];
    colorTheme = '#8B5CF6';
  } else if (taskLower.includes('design') || taskLower.includes('creative') || taskLower.includes('art')) {
    destinationName = 'Creative Coast';
    description = 'Where imagination meets skill to craft beautiful and meaningful designs.';
    relatedApps = ['Figma', 'Adobe Creative Suite', 'Sketch', 'Canva', 'Pinterest'];
    colorTheme = '#EC4899';
  } else if (taskLower.includes('read') || taskLower.includes('book') || taskLower.includes('reading')) {
    destinationName = 'Literary Lagoon';
    description = 'Dive deep into stories and knowledge that expand your mind and soul.';
    relatedApps = ['Kindle', 'Goodreads', 'Audible', 'Apple Books', 'Notion'];
    colorTheme = '#059669';
  } else {
    // Generic destination
    destinationName = `${task} Isle`;
    description = `A focused journey to accomplish ${task.toLowerCase()}, finding inner peace through concentration.`;
    relatedApps = ['Chrome', 'Notion', 'Calendar', 'Timer', 'Music'];
    colorTheme = '#3B82F6';
  }

  return {
    destination_name: destinationName,
    description,
    related_apps: relatedApps,
    color_theme: colorTheme,
  };
}