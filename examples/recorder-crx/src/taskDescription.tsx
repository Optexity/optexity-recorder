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
  const [taskDescription, setTaskDescription] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (taskDescription.trim())
      onStartCapturing(taskDescription);
  };

  return (
    <div className='task-description-container'>
      <form onSubmit={handleSubmit} className='task-description-form'>
        <h2>What would you like to automate?</h2>
        <textarea
          placeholder='Describe your task...'
          value={taskDescription}
          onChange={e => setTaskDescription(e.target.value)}
          className='task-description-input'
        />
        <button
          type='submit'
          className='start-capturing-button'
          disabled={!taskDescription.trim()}
        >
          Start Capturing
        </button>
      </form>
    </div>
  );
};
