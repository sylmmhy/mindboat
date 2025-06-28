// src/utils/debugDistraction.ts
import { supabase } from '../lib/supabase';

// Add this debugging utility to help diagnose the exact issue
declare global {
  interface Window {
    debugDistractionFlow: (voyageId: string) => Promise<void>;
  }
}

export const setupDebugTool = () => {
  window.debugDistractionFlow = async (voyageId: string) => {
    console.group('🔍 Debugging Distraction Data Flow');
    
    try {
      // 1. Check database connection
      console.log('1. Testing database connection...');
      const connectionTest = await supabase
        .from('voyages')
        .select('count')
        .limit(1);
      
      if (connectionTest.error) {
        console.error('❌ Database connection failed:', connectionTest.error);
        console.log('🔧 Fix: Check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
        return;
      }
      console.log('✅ Database connection successful');

      // 2. Check if voyage exists
      console.log('2. Checking voyage existence...');
      const { data: voyage, error: voyageError } = await supabase
        .from('voyages')
        .select('*')
        .eq('id', voyageId)
        .single();
      
      if (voyageError || !voyage) {
        console.error('❌ Voyage not found:', voyageError);
        console.log('🔧 Fix: Ensure the voyage ID is correct and the voyage exists in the database');
        return;
      }
      console.log('✅ Voyage found:', voyage);

      // 3. Check distraction events
      console.log('3. Checking distraction events...');
      const { data: distractions, error: distractionsError } = await supabase
        .from('distraction_events')
        .select('*')
        .eq('voyage_id', voyageId)
        .order('detected_at', { ascending: true });
      
      if (distractionsError) {
        console.error('❌ Failed to fetch distraction events:', distractionsError);
      } else {
        console.log(`✅ Found ${distractions?.length || 0} distraction events:`, distractions);
        
        if (distractions && distractions.length > 0) {
          console.table(distractions.map(d => ({
            type: d.type,
            detected_at: d.detected_at,
            duration_seconds: d.duration_seconds,
            is_resolved: d.is_resolved,
            user_response: d.user_response
          })));
        }
      }

      // 4. Test statistics calculation
      console.log('4. Testing statistics calculation...');
      const { error: statsError } = await supabase
        .rpc('calculate_voyage_statistics', { voyage_id_param: voyageId });
      
      if (statsError) {
        console.error('❌ Statistics calculation failed:', statsError);
        console.log('🔧 Fix: Run the database function fix script to update your database functions');
      } else {
        console.log('✅ Statistics calculation successful');
      }

      // 5. Check updated voyage data
      console.log('5. Checking updated voyage statistics...');
      const { data: updatedVoyage, error: updatedError } = await supabase
        .from('voyages')
        .select('*')
        .eq('id', voyageId)
        .single();
      
      if (updatedError) {
        console.error('❌ Failed to fetch updated voyage:', updatedError);
      } else {
        console.log('✅ Updated voyage statistics:', {
          distraction_count: updatedVoyage.distraction_count,
          total_distraction_time: updatedVoyage.total_distraction_time,
          focus_quality_score: updatedVoyage.focus_quality_score,
          avg_distraction_duration: updatedVoyage.avg_distraction_duration,
          return_to_course_rate: updatedVoyage.return_to_course_rate,
          most_common_distraction: updatedVoyage.most_common_distraction
        });
      }

      // 6. Test assessment data function
      console.log('6. Testing assessment data function...');
      const { data: assessmentData, error: assessmentError } = await supabase
        .rpc('get_voyage_assessment_data', { voyage_id_param: voyageId });
      
      if (assessmentError) {
        console.error('❌ Assessment data function failed:', assessmentError);
        console.log('🔧 Fix: Run the database function fix script to update your database functions');
      } else {
        console.log('✅ Assessment data function successful:', assessmentData);
        
        if (assessmentData) {
          console.log('📊 Assessment Data Structure:');
          console.log('- Voyage data:', assessmentData.voyage ? '✅' : '❌');
          console.log('- Distraction data:', assessmentData.distractions ? '✅' : '❌');
          console.log('- Distraction events count:', assessmentData.distractions?.events?.length || 0);
          console.log('- Summary stats:', assessmentData.distractions?.summary);
        }
      }

      // 7. Check for common issues
      console.log('7. Checking for common issues...');
      
      if (voyage.distraction_count === 0 && distractions && distractions.length > 0) {
        console.warn('⚠️ Mismatch: Voyage shows 0 distractions but events exist');
        console.log('🔧 Fix: Run the statistics calculation function or the database fix script');
      }
      
      if (voyage.focus_quality_score === null) {
        console.warn('⚠️ Focus quality score is null');
        console.log('🔧 Fix: Run the statistics calculation function');
      }
      
      if (distractions && distractions.some(d => d.duration_seconds === null && d.is_resolved === true)) {
        console.warn('⚠️ Some distractions are marked as resolved but have no duration');
        console.log('🔧 Fix: Check your distraction completion logic');
      }

      console.log('🎉 Debugging complete! Check the console output above for any issues and fixes.');
      
    } catch (error) {
      console.error('💥 Debugging failed with error:', error);
    } finally {
      console.groupEnd();
    }
  };
};