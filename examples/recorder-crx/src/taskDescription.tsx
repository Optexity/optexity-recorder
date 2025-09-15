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
}

export const TaskDescription: React.FC<TaskDescriptionProps> = ({ onStartCapturing }) => {
  return (
    <div className='landing-container'>
      <div className='logo'>
        <img src='Optexity_logo_small_black.svg' alt='Optexity Logo' width='64' height='64' />
      </div>
      <h3 className='greeting'>Hello, Optexity!</h3>
      <button
        className='start-capturing-button-landing'
        onClick={() => onStartCapturing('')}
      >
        <span className='capture-icon' />
        Start Capture
      </button>
    </div>
  );
};
