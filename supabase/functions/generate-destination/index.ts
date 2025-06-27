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

  if (taskLower.includes('论文') || taskLower.includes('研究') || taskLower.includes('paper')) {
    destinationName = '学术大陆';
    description = '在知识的海洋中探索真理，每一页都是通往智慧的航道。';
    relatedApps = ['Zotero', 'Notion', 'Word', 'Google Scholar', 'Mendeley'];
    colorTheme = '#8B5CF6';
  } else if (taskLower.includes('代码') || taskLower.includes('编程') || taskLower.includes('开发') || taskLower.includes('code')) {
    destinationName = '代码峡湾';
    description = '在逻辑与创造的交汇处，构建数字世界的奇迹。';
    relatedApps = ['VS Code', 'GitHub', 'Terminal', 'Stack Overflow', 'Docker'];
    colorTheme = '#10B981';
  } else if (taskLower.includes('钢琴') || taskLower.includes('音乐') || taskLower.includes('piano')) {
    destinationName = '艺术琴泉';
    description = '让指尖在黑白键上舞蹈，奏响心灵深处的旋律。';
    relatedApps = ['Simply Piano', 'Flowkey', 'YouTube', 'Metronome', 'MuseScore'];
    colorTheme = '#F59E0B';
  } else if (taskLower.includes('健身') || taskLower.includes('运动') || taskLower.includes('锻炼')) {
    destinationName = '健康山峰';
    description = '攀登身体与意志的高峰，在汗水中铸造更强的自己。';
    relatedApps = ['Nike Training', 'MyFitnessPal', 'Strava', 'Apple Health', 'YouTube'];
    colorTheme = '#EF4444';
  } else if (taskLower.includes('学习') || taskLower.includes('study')) {
    destinationName = '智慧群岛';
    description = '在知识的群岛间穿行，每一次学习都是新的发现之旅。';
    relatedApps = ['Anki', 'Notion', 'Khan Academy', 'Coursera', 'YouTube'];
    colorTheme = '#6366F1';
  } else if (taskLower.includes('写作') || taskLower.includes('文章') || taskLower.includes('writing')) {
    destinationName = '文字海湾';
    description = '在文字的海湾中挥洒思想，让每个句子都闪闪发光。';
    relatedApps = ['Notion', 'Typora', 'Grammarly', 'Hemingway Editor', 'Google Docs'];
    colorTheme = '#8B5CF6';
  } else {
    // Generic destination
    destinationName = `${task}之岛`;
    description = `专注完成${task}的美妙航程，在专注中找到内心的平静。`;
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