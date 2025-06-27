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
  const { currentVoyage, voyageHistory, startVoyage, endVoyage } = useVoyageStore();
  const [appState, setAppState] = useState<AppState>('auth');
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [completedVoyage, setCompletedVoyage] = useState<any>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (user) {
      loadDestinations(user.id);
      
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
  }, [user, lighthouseGoal, currentVoyage]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
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

  const handleStartVoyage = async (destination: Destination) => {
    if (!user) return;
    
    setSelectedDestination(destination);
    
    // Start the voyage in the store
    await startVoyage(destination.id, user.id, 25); // Default 25 minutes
    
    // Transition to sailing mode
    setAppState('sailing');
  };

  const handleEndVoyage = async () => {
    if (currentVoyage && selectedDestination) {
      // End the voyage in the store
      await endVoyage();
      
      // Set completed voyage data for the completion screen
      setCompletedVoyage({
        ...currentVoyage,
        destination: selectedDestination
      });
      
      // Transition to voyage complete screen
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

  const handleViewMap = () => {
    setAppState('map');
  };

  const handleManageDestinations = () => {
    setAppState('destinations');
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
        <VoyagePreparation 
          onStartVoyage={handleStartVoyage}
          onViewMap={handleViewMap}
          onManageDestinations={handleManageDestinations}
        />
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