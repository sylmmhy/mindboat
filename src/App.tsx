import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthForm } from './components/auth/AuthForm';
import { LighthouseGoal } from './components/onboarding/LighthouseGoal';
import { CreateDestination } from './components/onboarding/CreateDestination';
import { useUserStore } from './stores/userStore';
import { useDestinationStore } from './stores/destinationStore';

function App() {
  const { user, lighthouseGoal, initialize, isLoading } = useUserStore();
  const { loadDestinations } = useDestinationStore();
  const [onboardingStep, setOnboardingStep] = useState<'auth' | 'lighthouse' | 'destinations' | 'complete'>('auth');

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (user) {
      loadDestinations(user.id);
      
      // Determine onboarding step
      if (!lighthouseGoal) {
        setOnboardingStep('lighthouse');
      } else {
        setOnboardingStep('destinations');
      }
    } else {
      setOnboardingStep('auth');
    }
  }, [user, lighthouseGoal, loadDestinations]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  const handleAuthSuccess = () => {
    if (!lighthouseGoal) {
      setOnboardingStep('lighthouse');
    } else {
      setOnboardingStep('destinations');
    }
  };

  const handleLighthouseComplete = () => {
    setOnboardingStep('destinations');
  };

  const handleDestinationsComplete = () => {
    setOnboardingStep('complete');
  };

  return (
    <Router>
      <div className="App">
        {onboardingStep === 'auth' && (
          <AuthForm onSuccess={handleAuthSuccess} />
        )}
        
        {onboardingStep === 'lighthouse' && (
          <LighthouseGoal onComplete={handleLighthouseComplete} />
        )}
        
        {onboardingStep === 'destinations' && (
          <CreateDestination onComplete={handleDestinationsComplete} />
        )}
        
        {onboardingStep === 'complete' && (
          <div className="min-h-screen bg-gradient-to-br from-green-900 to-blue-900 flex items-center justify-center">
            <div className="text-center text-white">
              <h1 className="text-4xl font-bold mb-4">准备就绪！</h1>
              <p className="text-xl">你的MindBoat已经准备好启航了</p>
              <p className="text-lg mt-4 opacity-75">即将推出完整的航行体验...</p>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;