import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReflectionRequest {
  voyages?: any[];
  totalFocusTime?: number;
  voyageCount?: number;
  date?: string;
  reflections?: any[];
  type?: 'daily' | 'weekly_summary';
  weekStart?: string;
  weekEnd?: string;
}

interface ReflectionResponse {
  reflection: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: ReflectionRequest = await req.json();

    if (body.type === 'weekly_summary') {
      const reflection = generateWeeklySummaryFallback(body.reflections || []);
      return new Response(
        JSON.stringify({ reflection }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Daily reflection generation
    const { voyages = [], totalFocusTime = 0, voyageCount = 0 } = body;

    if (!voyages || voyageCount === 0) {
      const reflection = "Sometimes the sea is calm and we rest at harbor. Tomorrow brings new opportunities to set sail toward your dreams.";
      return new Response(
        JSON.stringify({ reflection }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For now, use fallback generation (in production, this would call OpenAI)
    const reflection = generateDailyReflectionFallback(voyages, totalFocusTime, voyageCount);

    return new Response(
      JSON.stringify({ reflection }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating reflection:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        reflection: 'Your journey continues. Every moment of focus is a step toward your lighthouse.'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function generateDailyReflectionFallback(voyages: any[], totalFocusTime: number, voyageCount: number): string {
  // Analyze voyage data for insights
  const destinations = voyages.map(v => v.destination?.destination_name).filter(Boolean);
  const uniqueDestinations = [...new Set(destinations)];
  const totalDistractions = voyages.reduce((sum, v) => sum + (v.distraction_count || 0), 0);
  
  // Calculate focus quality
  const averageDistractions = totalDistractions / voyageCount;
  const focusQuality = averageDistractions <= 1 ? 'excellent' : averageDistractions <= 3 ? 'good' : 'improving';
  
  // Seagull personality responses
  const personalityElements = [
    "🐦 *fluffs feathers thoughtfully*",
    "🌊 The seagull observed your journey today...",
    "⚓ From my perch on the mast, I witnessed...",
    "🧭 Your feathered companion noticed..."
  ];
  
  const encouragements = [
    "Your determination reminds me of the steady lighthouse beam.",
    "Like the tides, your focus grows stronger each day.",
    "The winds of intention carried you well today.",
    "Your voyage brings you closer to the lighthouse on the horizon."
  ];
  
  const observations = [];
  
  if (totalFocusTime >= 120) {
    observations.push("What impressive dedication! Over 2 hours of focused sailing shows the heart of a true navigator.");
  } else if (totalFocusTime >= 60) {
    observations.push("A solid hour of concentration - your focus flows like favorable winds.");
  } else if (totalFocusTime >= 30) {
    observations.push("Steady progress on the seas of attention. Every minute counts toward your destination.");
  }
  
  if (uniqueDestinations.length > 1) {
    observations.push(`You explored ${uniqueDestinations.length} different destinations today - quite the adventurous spirit!`);
  }
  
  if (focusQuality === 'excellent') {
    observations.push("Your focus was remarkably steady, like a ship guided by the stars.");
  } else if (totalDistractions > 0) {
    observations.push("Even with a few course corrections, you maintained your heading toward your goals.");
  }
  
  // Construct reflection
  const opening = personalityElements[Math.floor(Math.random() * personalityElements.length)];
  const mainObservation = observations.length > 0 ? observations.join(' ') : 
    `Today brought ${voyageCount} voyage${voyageCount === 1 ? '' : 's'} totaling ${totalFocusTime} minutes of focused navigation.`;
  const closing = encouragements[Math.floor(Math.random() * encouragements.length)];
  
  return `${opening} ${mainObservation} ${closing}`;
}

function generateWeeklySummaryFallback(reflections: any[]): string {
  if (reflections.length === 0) {
    return "A week of preparation and reflection. Like tides, focus ebbs and flows. Next week holds new opportunities for discovery.";
  }
  
  const totalTime = reflections.reduce((sum, r) => sum + (r.total_focus_time || 0), 0);
  const totalVoyages = reflections.reduce((sum, r) => sum + (r.voyage_count || 0), 0);
  const activeDays = reflections.filter(r => (r.voyage_count || 0) > 0).length;
  const averageDailyTime = activeDays > 0 ? Math.round(totalTime / activeDays) : 0;
  
  let summary = `🐦 *The seagull reviews the week's logbook* 📋\n\n`;
  
  if (totalTime === 0) {
    summary += "A week of preparation and reflection. Sometimes the wisest sailors spend time in harbor, planning their next great adventure.";
  } else {
    summary += `This week you sailed ${totalVoyages} voyages across ${activeDays} active days. `;
    
    if (totalTime >= 300) { // 5+ hours
      summary += `With ${Math.round(totalTime / 60)} hours of focused navigation, you've shown remarkable dedication! `;
    } else if (totalTime >= 120) { // 2+ hours
      summary += `Your ${Math.round(totalTime / 60)} hours of concentrated sailing shows steady progress. `;
    } else {
      summary += `Every minute of your ${totalTime} minutes of focus counts toward your lighthouse. `;
    }
    
    if (activeDays >= 5) {
      summary += "Your consistency is like the reliable lighthouse beam - always there when needed.";
    } else if (activeDays >= 3) {
      summary += "A good balance of action and rest, like the natural rhythm of the tides.";
    } else {
      summary += "Quality over quantity - your focused sessions show intentional navigation.";
    }
  }
  
  summary += "\n\n🌅 The horizon holds endless possibilities for the week ahead!";
  
  return summary;
}