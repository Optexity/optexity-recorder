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
import './apiKeyInputScreen.css';

interface APIKeyInputScreenProps {
  onStartCapturing: (apiKey: string) => void;
}

export const APIKeyInputScreen: React.FC<APIKeyInputScreenProps> = ({ onStartCapturing }) => {
  const [apiKey, setApiKey] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      const trimmedKey = apiKey.trim();
      localStorage.setItem('optexity_api_key', trimmedKey);
      onStartCapturing(trimmedKey);
    }
  };

  return (
    <div className='api-key-container'>
      <div className='api-key-form'>
        <div className='logo'>
          <img src='Optexity_logo_small_black.svg' alt='Optexity Logo' width='64' height='64' />
        </div>
        <h2 className='api-key-title'>Enter your Optexity API key</h2>
        <form onSubmit={handleSubmit}>
          <input
            type='text'
            className='api-key-input'
            placeholder='Enter your API key'
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            autoFocus
          />
          <p className='api-key-help'>
            Don&apos;t have an API key?{' '}
            <a
              href='https://optexity.com/login'
              target='_blank'
              rel='noopener noreferrer'
              className='api-key-link'
            >
              Get one here
            </a>
          </p>
          <button
            type='submit'
            className='api-key-submit-button'
            disabled={!apiKey.trim()}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
};
