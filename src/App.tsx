import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthForm } from './components/auth/AuthForm';
import { LighthouseGoal } from './components/onboarding/LighthouseGoal';
import { CreateDestination } from './components/onboarding/CreateDestination';
import { VoyagePreparation } from './components/sailing/VoyagePreparation';
import { SailingMode } from './components/sailing/SailingMode';
import { VoyageComplete } from './components/sailing/VoyageComplete';
import { GrandMap } from './components/visualization/GrandMap';
import { useUserStore } from './stores/userStore';
import { useDestinationStore } from './stores/destinationStore';
import { useVoyageStore } from './stores/voyageStore';
import type { Destination } from './types';

type AppState = 'auth' | 'lighthouse' | 'destinations' | 'voyage-prep' | 'sailing' | 'voyage-complete' | 'map';

function App() {
  const { user, lighthouseGoal, initialize, isLoading } = useUserStore();
  const { destinations, loadDestinations } = useDestinationStore();
  const { currentVoyage, voyageHistory } = useVoyageStore();
  const [appState, setAppState] = useState<AppState>('auth');
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [completedVoyage, setCompletedVoyage] = useState<any>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (user) {
      loadDestinations(user.id);
      
      // Determine app state based on user progress
      if (!lighthouseGoal) {
        setAppState('lighthouse');
      } else if (destinations.length === 0) {
        setAppState('destinations');
      } else if (currentVoyage) {
        setAppState('sailing');
      } else {
        setAppState('voyage-prep');
      }
    } else {
      setAppState('auth');
    }
  }, [user, lighthouseGoal, destinations, currentVoyage, loadDestinations]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  const handleAuthSuccess = () => {
    if (!lighthouseGoal) {
      setAppState('lighthouse');
    } else if (destinations.length === 0) {
      setAppState('destinations');
    } else {
      setAppState('voyage-prep');
    }
  };

  const handleLighthouseComplete = () => {
    setAppState('destinations');
  };

  const handleDestinationsComplete = () => {
    setAppState('voyage-prep');
  };

  const handleStartVoyage = (destination: Destination) => {
    setSelectedDestination(destination);
    setAppState('sailing');
  };

  const handleEndVoyage = () => {
    if (currentVoyage && selectedDestination) {
      setCompletedVoyage({
        ...currentVoyage,
        destination: selectedDestination
      });
      setAppState('voyage-complete');
    }
  };

  const handleVoyageCompleteNext = () => {
    setAppState('map');
  };

  const handleBackToPrep = () => {
    setSelectedDestination(null);
    setCompletedVoyage(null);
    setAppState('voyage-prep');
  };

  return (
    <div className="App">
      {appState === 'auth' && (
        <AuthForm onSuccess={handleAuthSuccess} />
      )}
      
      {appState === 'lighthouse' && (
        <LighthouseGoal onComplete={handleLighthouseComplete} />
      )}
      
      {appState === 'destinations' && (
        <CreateDestination onComplete={handleDestinationsComplete} />
      )}
      
      {appState === 'voyage-prep' && (
        <VoyagePreparation onStartVoyage={handleStartVoyage} />
      )}
      
      {appState === 'sailing' && selectedDestination && (
        <SailingMode 
          destination={selectedDestination} 
          onEndVoyage={handleEndVoyage}
        />
      )}
      
      {appState === 'voyage-complete' && completedVoyage && (
        <VoyageComplete
          voyage={completedVoyage}
          destination={completedVoyage.destination}
          onContinue={handleVoyageCompleteNext}
        />
      )}
      
      {appState === 'map' && (
        <GrandMap onBack={handleBackToPrep} />
      )}
    </div>
  );
}

export default App;