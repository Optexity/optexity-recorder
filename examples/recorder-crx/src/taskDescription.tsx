/**
 * Copyright (c) Rui Figueira.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import './taskDescription.css';

interface TaskDescriptionProps {
  onStartCapturing: (taskDescription: string) => void;
  onLogout: () => void;
}

export const TaskDescription: React.FC<TaskDescriptionProps> = ({ onStartCapturing, onLogout }) => {
  const [countdown, setCountdown] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (countdown === null)
      return;

    if (countdown === 0) {
      onStartCapturing('');
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onStartCapturing]);

  const handleStartCapture = () => {
    setCountdown(5);
  };

  return (
    <div className='landing-container'>
      {countdown !== null && (
        <div className='countdown-overlay'>
          <div className='countdown-number'>{countdown}</div>
        </div>
      )}
      <div className='logo'>
        <img src='Optexity_logo_small_black.svg' alt='Optexity Logo' width='64' height='64' />
      </div>
      <h3 className='greeting'>Hello, Optexity!</h3>
      <button
        className='start-capturing-button-landing'
        onClick={handleStartCapture}
        disabled={countdown !== null}
      >
        <span className='capture-icon' />
        Start Capture
      </button>
      <button
        className='logout-button-landing'
        onClick={onLogout}
        disabled={countdown !== null}
      >
        Logout
      </button>
    </div>
  );
};
