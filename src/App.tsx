import React, { useEffect, useState } from 'react';
import { SplineScene } from './components/SplineScene';
import { SplineEventHandler } from './components/SplineEventHandler';
import { AuthForm } from './components/auth/AuthForm';
import { LighthouseGoal } from './components/onboarding/LighthouseGoal';
import { CreateDestination } from './components/onboarding/CreateDestination';
import { VoyagePreparation } from './components/sailing/VoyagePreparation';
import { SailingMode } from './components/sailing/SailingMode';
import { VoyageComplete } from './components/sailing/VoyageComplete';
import { GrandMap } from './components/visualization/GrandMap';
import { NotificationSystem } from './components/ui/NotificationSystem';
import { useUserStore } from './stores/userStore';
import { useDestinationStore } from './stores/destinationStore';
import { useVoyageStore } from './stores/voyageStore';
import { useNotificationStore } from './stores/notificationStore';
import type { Destination } from './types';
import { setupDebugTool } from './utils/debugDistraction';

type AppState = 'auth' | 'lighthouse' | 'destinations' | 'voyage-prep' | 'sailing' | 'voyage-complete' | 'map';

function App() {
  const {
    user,
    lighthouseGoal,
    initialize,
    isLoading,
    isAuthenticated,
    authMode,
    error: authError
  } = useUserStore();

  const { destinations, loadDestinations } = useDestinationStore();
  const { currentVoyage, voyageHistory, startVoyage, endVoyage } = useVoyageStore();
  const { showSuccess, showError } = useNotificationStore();

  const [appState, setAppState] = useState<AppState>('auth');
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [completedVoyageId, setCompletedVoyageId] = useState<string | null>(null);
  const [initializationComplete, setInitializationComplete] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Initialize the app
  useEffect(() => {
    const initApp = async () => {
      await initialize();
      setInitializationComplete(true);
    };

    initApp();
  }, [initialize]);

  // Debug
  useEffect(() => {
    if (import.meta.env.DEV) {
      setupDebugTool();
    }
  }, []);

  // Handle state transitions after initialization
  useEffect(() => {
    if (!initializationComplete) return;

    if (isAuthenticated && user) {
      // Only show welcome notification for non-demo mode and don't repeat
      if (authMode === 'supabase' && !localStorage.getItem('welcome-shown')) {
        showSuccess(
          `Welcome back, ${user.email}!`,
          'Successfully signed in'
        );
        localStorage.setItem('welcome-shown', 'true');
      }

      // Load user data
      if (authMode === 'supabase') {
        loadDestinations(user.id);
      }

      // Determine app state based on user progress and current voyage
      if (!lighthouseGoal) {
        setAppState('lighthouse');
      } else if (currentVoyage && appState !== 'sailing') {
        // If there's an active voyage and we're not already in sailing mode
        setAppState('sailing');
      } else if (appState === 'auth') {
        // Only set to voyage-prep if we're coming from auth
        setAppState('voyage-prep');
      }
    } else {
      setAppState('auth');
    }
  }, [isAuthenticated, user, lighthouseGoal, currentVoyage, authMode, initializationComplete]);

  // Show auth errors as notifications (keep this as it's important)
  useEffect(() => {
    if (authError && initializationComplete) {
      showError(authError, 'Authentication Error');
    }
  }, [authError, initializationComplete, showError]);

  // 监听模态框状态变化
  useEffect(() => {
    const handleModalStateChange = (event: CustomEvent) => {
      setIsModalOpen(event.detail.isOpen);
    };

    window.addEventListener('modalStateChange', handleModalStateChange as EventListener);
    
    return () => {
      window.removeEventListener('modalStateChange', handleModalStateChange as EventListener);
    };
  }, []);

  const handleSplineEvent = (event: any) => {
    console.log('Spline event received in App:', event);
    // You can add custom logic here to handle different types of events
    // For example, trigger different animations or UI changes based on event.payload
  };

  // Show loading screen during initialization
  if (!initializationComplete || isLoading) {
    return (
      <div className="relative h-screen">
        {/* 3D Scene Background */}
        <SplineScene isInteractionDisabled={true} />
        
        {/* Loading Overlay */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <div className="text-white text-xl font-playfair">
              {isLoading ? 'Loading...' : 'Initializing MindBoat...'}
            </div>
            {authError && (
              <div className="mt-4 text-red-300 text-sm max-w-md">
                {authError}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleAuthSuccess = () => {
    if (!lighthouseGoal) {
      setAppState('lighthouse');
    } else {
      setAppState('voyage-prep');
    }
  };

  const handleLighthouseComplete = () => {
    // Skip destinations if user already has some, go straight to voyage prep
    if (destinations.length > 0) {
      setAppState('voyage-prep');
    } else {
      setAppState('destinations');
    }
  };

  const handleDestinationsComplete = () => {
    setAppState('voyage-prep');
  };

  const handleStartVoyage = async (destination: Destination, plannedDuration: number) => {
    if (!user) return;

    setSelectedDestination(destination);

    try {
      // Start the voyage in the store
      await startVoyage(destination.id, user.id, plannedDuration);

      // Transition to sailing mode
      setAppState('sailing');
    } catch (error) {
      console.error('Failed to start voyage:', error);
      showError(
        'Failed to start your voyage. Please try again.',
        'Voyage Error'
      );
    }
  };

  const handleEndVoyage = async () => {
    if (currentVoyage && selectedDestination) {
      try {
        // End the voyage in the store
        const updatedVoyage = await endVoyage();

        // Set completed voyage data for the completion screen
        if (updatedVoyage) {
          setCompletedVoyageId(updatedVoyage.id);
        } else {
          // Fallback: use current voyage ID
          setCompletedVoyageId(currentVoyage.id);
        }

        // Transition to voyage complete screen
        setAppState('voyage-complete');
      } catch (error) {
        console.error('Failed to end voyage:', error);
        showError(
          'Failed to complete your voyage. Please try again.',
          'Voyage Error'
        );
      }
    }
  };

  const handleVoyageCompleteNext = () => {
    setAppState('map');
  };

  const handleBackToPrep = () => {
    setSelectedDestination(null);
    setAppState('voyage-prep');
  };

  const handleViewMap = () => {
    setAppState('map');
  };

  const handleManageDestinations = () => {
    setAppState('destinations');
  };

  const handleBackToAuth = () => {
    setAppState('auth');
  };

  const renderCurrentState = () => {
    switch (appState) {
      case 'auth':
        return <AuthForm onSuccess={handleAuthSuccess} />;
      
      case 'lighthouse':
        return <LighthouseGoal onComplete={handleLighthouseComplete} />;
      
      case 'destinations':
        return <CreateDestination onComplete={handleDestinationsComplete} />;
      
             case 'voyage-prep':
         return (
           <VoyagePreparation
             onStartVoyage={handleStartVoyage}
             onViewMap={handleViewMap}
             onManageDestinations={handleManageDestinations}
           />
         );
       
       case 'sailing':
         return selectedDestination ? (
           <SailingMode
             destination={selectedDestination}
             onEndVoyage={handleEndVoyage}
           />
         ) : null;
       
       case 'voyage-complete':
         return completedVoyageId ? (
           <VoyageComplete
             voyageId={completedVoyageId}
             onContinue={handleVoyageCompleteNext}
           />
         ) : null;
       
       case 'map':
         return (
           <GrandMap
             onBack={handleBackToPrep}
           />
         );
      
      default:
        return null;
    }
  };

  return (
    <div className="relative h-screen overflow-hidden">
      {/* 3D Scene Background - 传递交互禁用状态 */}
      <SplineScene isInteractionDisabled={isModalOpen || appState !== 'voyage-prep'} />
      
      {/* Spline Event Handler - handles real-time events from Spline */}
      <SplineEventHandler 
        onEventReceived={handleSplineEvent}
        onModalStateChange={setIsModalOpen}
      />

      {/* Subtle gradient overlay for depth */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20 pointer-events-none z-10"></div>

      {/* Main Application Content */}
      <div className="relative z-20">
        {renderCurrentState()}
      </div>

      {/* Notification System */}
      <NotificationSystem />

      {/* Manual Test Button - positioned at bottom right */}
      <div className="fixed bottom-4 right-4 z-30">
        <button
          onClick={async () => {
            try {
              const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-seagull-webhook`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ numbaer5: 0 })
              });
              
              if (response.ok) {
                console.log('Test seagull webhook triggered successfully');
              } else {
                console.error('Failed to trigger test webhook');
              }
            } catch (error) {
              console.error('Error triggering test webhook:', error);
            }
          }}
          className="px-4 py-2 bg-gradient-to-br from-white/15 via-white/10 to-white/8
                     hover:from-white/20 hover:via-white/15 hover:to-white/12
                     text-white rounded-xl transition-all duration-300
                     border border-white/25 hover:border-white/35
                     font-inter font-medium text-sm backdrop-blur-md
                     shadow-[0_4px_16px_rgba(0,0,0,0.1),0_1px_4px_rgba(0,0,0,0.06)]
                     transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Talk to Seagull
        </button>
      </div>
    </div>
  );
}

export default App;
