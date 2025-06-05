/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { CallLog, ElementInfo, Mode, Source } from './recorderTypes';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import type { SourceHighlight } from '@web/components/codeMirrorWrapper';
import { SplitView } from '@web/components/splitView';
import { TabbedPane } from '@web/components/tabbedPane';
import { Toolbar } from '@web/components/toolbar';
import { emptySource, SourceChooser } from '@web/components/sourceChooser';
import { ToolbarButton, ToolbarSeparator } from '@web/components/toolbarButton';
import * as React from 'react';
import { CallLogView } from './callLog';
import './recorder.css';
import { asLocator } from '@isomorphic/locatorGenerators';
import { toggleTheme } from '@web/theme';
import { copy, useSetting } from '@web/uiUtils';
import yaml from 'yaml';
import { parseAriaSnapshot } from '@isomorphic/ariaSnapshot';

export interface RecorderProps {
  sources: Source[],
  paused: boolean,
  log: Map<string, CallLog>,
  mode: Mode,
  onEditedCode?: (code: string) => any,
  onCursorActivity?: (position: { line: number }) => any,
  onSaveCode?: () => any,
}

const ActionCard: React.FC<{ index: number, message: string }> = ({ index, message }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    padding: '10px 16px',
    margin: '8px',
    minWidth: 180,
    maxWidth: 220,
    width: '100%',
    boxSizing: 'border-box',
  }}>
    <div style={{
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: '#eef0ff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#5b6dfa',
      fontWeight: 700,
      fontSize: 15,
      marginRight: 12,
    }}>{index}</div>
    <div style={{ fontSize: 15, color: '#23272f', wordBreak: 'break-word' }}>{message}</div>
  </div>
);

export const Recorder: React.FC<RecorderProps> = ({
  sources,
  paused,
  log,
  mode,
  onEditedCode,
  onCursorActivity,
  onSaveCode,
}) => {
  const [selectedFileId, setSelectedFileId] = React.useState<string | undefined>();
  const [runningFileId, setRunningFileId] = React.useState<string | undefined>();
  const [selectedTab, setSelectedTab] = useSetting<string>('recorderPropertiesTab', 'log');
  const [ariaSnapshot, setAriaSnapshot] = React.useState<string | undefined>();
  const [ariaSnapshotErrors, setAriaSnapshotErrors] = React.useState<SourceHighlight[]>();
  const [selectorFocusOnChange, setSelectorFocusOnChange] = React.useState<boolean | undefined>(true);

  const fileId = selectedFileId || runningFileId || sources[0]?.id;

  const source = React.useMemo(() => {
    if (fileId) {
      const source = sources.find(s => s.id === fileId);
      if (source)
        return source;
    }
    return emptySource();
  }, [sources, fileId]);

  const [locator, setLocator] = React.useState('');
  window.playwrightElementPicked = (elementInfo: ElementInfo, userGesture?: boolean) => {
    const language = source.language;
    setLocator(asLocator(language, elementInfo.selector));
    setAriaSnapshot(elementInfo.ariaSnapshot);
    setAriaSnapshotErrors([]);
    setSelectorFocusOnChange(userGesture);

    if (userGesture && selectedTab !== 'locator' && selectedTab !== 'aria')
      setSelectedTab('locator');

    if (mode === 'inspecting' && selectedTab === 'aria') {
      // Keep exploring aria.
    } else {
      const isRecording = ['recording', 'assertingText', 'assertingVisibility', 'assertingValue', 'assertingSnapshot'].includes(mode);
      window.dispatch({ event: 'setMode', params: { mode: isRecording ? 'recording' : 'standby' } }).catch(() => { });
    }
  };

  window.playwrightSetRunningFile = setRunningFileId;

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const actionCards = React.useMemo(() => {
    const lines = source.text.split('\n');
    let index = 1;
    const cards: { index: number, message: string }[] = [];
    for (const line of lines) {
      if (line.includes('click')) {
        cards.push({ index: index++, message: 'Click this field.' });
      } else if (line.includes('fill')) {
        cards.push({ index: index++, message: 'type text' });
      }
    }
    return cards;
  }, [source.text]);

  React.useLayoutEffect(() => {
    if (messagesEndRef.current && containerRef.current) {
      containerRef.current.scrollTo({
        top: messagesEndRef.current.offsetTop - containerRef.current.offsetHeight + messagesEndRef.current.offsetHeight,
        behavior: 'smooth'
      });
    }
  }, [actionCards]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'F8':
          event.preventDefault();
          if (paused)
            window.dispatch({ event: 'resume' });
          else
            window.dispatch({ event: 'pause' });
          break;
        case 'F10':
          event.preventDefault();
          if (paused)
            window.dispatch({ event: 'step' });
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [paused]);

  // Add click outside handler for dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdowns = document.querySelectorAll('.dropdown');
      dropdowns.forEach(dropdown => {
        const button = dropdown.querySelector('.toolbar-button');
        const content = dropdown.querySelector('.dropdown-content');
        if (button && content && !dropdown.contains(event.target as Node)) {
          content.classList.remove('show');
          button.classList.remove('active');
        }
      });
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const onEditorChange = React.useCallback((selector: string) => {
    if (mode === 'none' || mode === 'inspecting')
      window.dispatch({ event: 'setMode', params: { mode: 'standby' } });
    setLocator(selector);
    window.dispatch({ event: 'highlightRequested', params: { selector } });
  }, [mode]);

  const onAriaEditorChange = React.useCallback((ariaSnapshot: string) => {
    if (mode === 'none' || mode === 'inspecting')
      window.dispatch({ event: 'setMode', params: { mode: 'standby' } });
    const { fragment, errors } = parseAriaSnapshot(yaml, ariaSnapshot, { prettyErrors: false });
    const highlights = errors.map(error => {
      const highlight: SourceHighlight = {
        message: error.message,
        line: error.range[1].line,
        column: error.range[1].col,
        type: 'subtle-error',
      };
      return highlight;
    });
    setAriaSnapshotErrors(highlights);
    setAriaSnapshot(ariaSnapshot);
    if (!errors.length)
      window.dispatch({ event: 'highlightRequested', params: { ariaTemplate: fragment } });
  }, [mode]);

  return <div className='recorder' style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
    <div style={{ justifyContent: 'space-between', padding: '0 16px' }}>
      <Toolbar>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
          <ToolbarButton
            icon={paused ? 'play' : 'debug-pause'}
            title={paused ? 'Resume' : 'Pause'}
            toggled={mode === 'recording' || mode === 'recording-inspecting' || mode === 'assertingText' || mode === 'assertingVisibility'}
            onClick={() => {
              window.dispatch({ event: 'setMode', params: { mode: mode === 'none' || mode === 'standby' || mode === 'inspecting' ? 'recording' : 'standby' } });
            }}
            className="main-button"
            style={{
              background: mode === 'recording' || mode === 'recording-inspecting' || mode === 'assertingText' || mode === 'assertingVisibility'
                ? 'var(--vscode-button-background)'
                : 'var(--vscode-button-secondaryBackground)',
              color: mode === 'recording' || mode === 'recording-inspecting' || mode === 'assertingText' || mode === 'assertingVisibility'
                ? 'var(--vscode-button-foreground)'
                : 'var(--vscode-button-secondaryForeground)',
            }}
          >
            {paused ? 'Resume' : 'Pause'}
          </ToolbarButton>
          <ToolbarButton
            icon="check"
            title="Complete recording"
            onClick={onSaveCode}
            className="main-button"
            style={{
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
            }}
          >
            Complete
          </ToolbarButton>
          <div className="dropdown">
            <ToolbarButton
              icon="more"
              title="More options"
              style={{
                padding: '4px 8px',
                opacity: 0.8,
                fontSize: '16px'
              }}
              onClick={(e) => {
                e.stopPropagation();
                const dropdownContent = e.currentTarget.nextElementSibling;
                const isActive = e.currentTarget.classList.contains('active');
                // Close all other dropdowns
                document.querySelectorAll('.dropdown-content.show').forEach(el => {
                  if (el !== dropdownContent) el.classList.remove('show');
                });
                document.querySelectorAll('.toolbar-button.active').forEach(el => {
                  if (el !== e.currentTarget) el.classList.remove('active');
                });
                // Toggle current dropdown
                if (dropdownContent) {
                  dropdownContent.classList.toggle('show');
                  e.currentTarget.classList.toggle('active');
                }
              }}
            />
            <div className="dropdown-content">
              <ToolbarButton
                icon='inspect'
                title='Pick locator'
                toggled={mode === 'inspecting' || mode === 'recording-inspecting'}
                onClick={() => {
                  const newMode = {
                    'inspecting': 'standby',
                    'none': 'inspecting',
                    'standby': 'inspecting',
                    'recording': 'recording-inspecting',
                    'recording-inspecting': 'recording',
                    'assertingText': 'recording-inspecting',
                    'assertingVisibility': 'recording-inspecting',
                    'assertingValue': 'recording-inspecting',
                    'assertingSnapshot': 'recording-inspecting',
                  }[mode];
                  window.dispatch({ event: 'setMode', params: { mode: newMode } }).catch(() => { });
                }}
              >
                Pick locator
              </ToolbarButton>
              <ToolbarButton
                icon='eye'
                title='Assert visibility'
                toggled={mode === 'assertingVisibility'}
                disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'}
                onClick={() => {
                  window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingVisibility' ? 'recording' : 'assertingVisibility' } });
                }}
              >
                Assert visibility
              </ToolbarButton>
              <ToolbarButton
                icon='whole-word'
                title='Assert text'
                toggled={mode === 'assertingText'}
                disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'}
                onClick={() => {
                  window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingText' ? 'recording' : 'assertingText' } });
                }}
              >
                Assert text
              </ToolbarButton>
              <ToolbarButton
                icon='symbol-constant'
                title='Assert value'
                toggled={mode === 'assertingValue'}
                disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'}
                onClick={() => {
                  window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingValue' ? 'recording' : 'assertingValue' } });
                }}
              >
                Assert value
              </ToolbarButton>
              <ToolbarButton
                icon='gist'
                title='Assert snapshot'
                toggled={mode === 'assertingSnapshot'}
                disabled={mode === 'none' || mode === 'standby' || mode === 'inspecting'}
                onClick={() => {
                  window.dispatch({ event: 'setMode', params: { mode: mode === 'assertingSnapshot' ? 'recording' : 'assertingSnapshot' } });
                }}
              >
                Assert snapshot
              </ToolbarButton>
            </div>
          </div>
        </div>
      </Toolbar>
    </div>
    <div
      ref={containerRef}
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        padding: '0 16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        gap: '0',
        overflowY: 'auto',
        width: '100vw',
        boxSizing: 'border-box',
      }}
    >
      {actionCards.map(card => (
        <ActionCard key={card.index} index={card.index} message={card.message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  </div>;
};
