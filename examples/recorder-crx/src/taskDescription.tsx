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
      <button
        className='logout-button-top-right'
        onClick={onLogout}
        disabled={countdown !== null}
      >
        <svg width='16' height='16' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'>
          <path d='M6 2H3C2.44772 2 2 2.44772 2 3V13C2 13.5523 2.44772 14 3 14H6M11 12L14 8M14 8L11 4M14 8H6' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'/>
        </svg>
        <span>Logout</span>
      </button>
      <div className='logo'>
        <img src='Optexity_logo_small_black.svg' alt='Optexity Logo' width='64' height='64' />
      </div>
      <h3 className='greeting'>Hello, there!</h3>
      <button
        className='start-capturing-button-landing'
        onClick={handleStartCapture}
        disabled={countdown !== null}
      >
        <span className='capture-icon' />
        Start Capture
      </button>
    </div>
  );
};
