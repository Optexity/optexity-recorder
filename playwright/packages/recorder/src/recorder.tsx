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
import { useRef, useEffect } from 'react';

export interface RecorderProps {
  sources: Source[],
  paused: boolean,
  log: Map<string, CallLog>,
  mode: Mode,
  onEditedCode?: (code: string) => any,
  onCursorActivity?: (position: { line: number }) => any,
  onSaveCode?: () => any,
  onDelete?: () => any,
}

// Python syntax highlighter
const highlightPython = (code: string): React.ReactNode[] => {
  const pythonKeywords = ['await', 'async', 'def', 'class', 'if', 'else', 'elif', 'for', 'while', 'try', 'except', 'finally', 'with', 'import', 'from', 'as', 'return', 'yield', 'pass', 'break', 'continue', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'lambda'];
  const parts: React.ReactNode[] = [];
  
  // Process the code
  const tokens: Array<{ start: number, end: number, type: string, text: string, color: string }> = [];
  let match;
  
  // First, find all string tokens (so we can exclude # inside strings from being treated as comments)
  const stringRegex = /(['"])(?:(?=(\\?))\2.)*?\1/g;
  const stringRanges: Array<{ start: number, end: number }> = [];
  while ((match = stringRegex.exec(code)) !== null) {
    stringRanges.push({ start: match.index, end: match.index + match[0].length });
    tokens.push({ start: match.index, end: match.index + match[0].length, text: match[0], type: 'string', color: '#032f62' });
  }
  
  // Helper to check if a position is inside a string
  const isInsideString = (pos: number) => stringRanges.some(s => pos >= s.start && pos < s.end);
  
  // Handle comments - only match # that's NOT inside a string
  const commentRegex = /#.*$/gm;
  while ((match = commentRegex.exec(code)) !== null) {
    if (!isInsideString(match.index)) {
      tokens.push({ start: match.index, end: match.index + match[0].length, text: match[0], type: 'comment', color: '#6a737d' });
    }
  }
  
  // Add number tokens
  const numberRegex = /\b\d+\.?\d*\b/g;
  while ((match = numberRegex.exec(code)) !== null) {
    if (!tokens.some(t => match!.index >= t.start && match!.index < t.end)) {
      tokens.push({ start: match.index, end: match.index + match[0].length, text: match[0], type: 'number', color: '#005cc5' });
    }
  }
  
  // Add function call tokens
  const functionRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  while ((match = functionRegex.exec(code)) !== null) {
    if (!tokens.some(t => match!.index >= t.start && match!.index < t.end)) {
      tokens.push({ start: match.index, end: match.index + match[1].length, text: match[1], type: 'function', color: '#6f42c1' });
    }
  }
  
  // Add keyword tokens
  pythonKeywords.forEach(keyword => {
    const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'g');
    while ((match = keywordRegex.exec(code)) !== null) {
      if (!tokens.some(t => match!.index >= t.start && match!.index < t.end)) {
        tokens.push({ start: match.index, end: match.index + match[0].length, text: match[0], type: 'keyword', color: '#d73a49' });
      }
    }
  });
  
  // Sort tokens by position
  tokens.sort((a, b) => a.start - b.start);
  
  // Build React elements
  let currentIndex = 0;
  tokens.forEach(token => {
    // Add text before token
    if (token.start > currentIndex) {
      const text = code.substring(currentIndex, token.start);
      if (text) {
        parts.push(<span key={`text-${currentIndex}`}>{text}</span>);
      }
    }
    
    // Add highlighted token
    parts.push(
      <span key={`token-${token.start}`} style={{ color: token.color, fontWeight: token.type === 'keyword' ? 600 : 'normal' }}>
        {token.text}
      </span>
    );
    
    currentIndex = token.end;
  });
  
  // Add remaining text
  if (currentIndex < code.length) {
    const text = code.substring(currentIndex);
    if (text) {
      parts.push(<span key={`text-${currentIndex}`}>{text}</span>);
    }
  }
  
  return parts.length > 0 ? parts : [<span key="code">{code}</span>];
};

const ActionCard: React.FC<{ index: number, message: string, code: string }> = ({ index, message, code }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const highlightedCode = React.useMemo(() => highlightPython(code), [code]);

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      margin: '8px 0',
      width: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      flexShrink: 0,
    }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 16px',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
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
          flexShrink: 0,
        }}>{index}</div>
        <div style={{ 
          fontSize: 15, 
          color: '#23272f', 
          wordBreak: 'break-word',
          flex: 1,
        }}>{message}</div>
        <div style={{
          marginLeft: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
          transition: 'transform 0.2s ease',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      {isExpanded && (
        <div style={{
          padding: '0 16px 12px 16px',
          borderTop: '1px solid #f3f4f6',
          marginTop: '8px',
          paddingTop: '12px',
        }}>
          <div style={{
            fontSize: 13,
            fontFamily: 'monospace',
            background: '#f9fafb',
            color: '#24292e',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
            overflowX: 'auto',
            lineHeight: '1.6',
          }}>
            {highlightedCode}
          </div>
        </div>
      )}
    </div>
  );
};

export const Recorder: React.FC<RecorderProps> = ({
  sources,
  paused,
  log,
  mode,
  onEditedCode,
  onCursorActivity,
  onSaveCode,
  onDelete,
}) => {
  const [selectedFileId, setSelectedFileId] = React.useState<string | undefined>();
  const [runningFileId, setRunningFileId] = React.useState<string | undefined>();
  const [selectedTab, setSelectedTab] = useSetting<string>('recorderPropertiesTab', 'log');
  const [ariaSnapshot, setAriaSnapshot] = React.useState<string | undefined>();
  const [ariaSnapshotErrors, setAriaSnapshotErrors] = React.useState<SourceHighlight[]>();
  const [selectorFocusOnChange, setSelectorFocusOnChange] = React.useState<boolean | undefined>(true);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

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
    const cards: { index: number, message: string, code: string }[] = [];
    for (const [i, line] of lines.entries()) {
      if (line.includes('.click(')) {
        cards.push({ index: index++, message: 'Click element action', code: line.split('# {"uuid":')[0].trim() });
      }
      else if (line.includes('.dblclick(')) {
        cards.push({ index: index++, message: 'Double click element action', code: line.split('# {"uuid":')[0].trim() });
      }
      else if (line.includes('.fill(') && (i == (lines.length - 1) || (!line.includes('"merge_with_previous": "true"') && !lines[i+1].includes('"merge_with_previous": "true"')) || (line.includes('"merge_with_previous": "true"') && !lines[i+1].includes('"merge_with_previous": "true"')))) {
        cards.push({ index: index++, message: 'Type text action', code: line.split('# {"uuid":')[0].trim() });
      }
      else if (line.includes('.select_option(')) {
        cards.push({ index: index++, message: 'Select option action', code: line.split('# {"uuid":')[0].trim() });
      }
      else if (line.includes('.check(')) {
        cards.push({ index: index++, message: 'Check checkbox action', code: line.split('# {"uuid":')[0].trim() });
      }
      else if (line.includes('.uncheck(')) {
        cards.push({ index: index++, message: 'Uncheck checkbox action', code: line.split('# {"uuid":')[0].trim() });
      }
    }
    return cards;
  }, [source.text]);

  React.useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
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

  const dropdownRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dropdown = dropdownRef.current;
    const btn = moreBtnRef.current;
    if (dropdown && btn && dropdown.classList.contains('show')) {
      // Get bounding rects
      const btnRect = btn.getBoundingClientRect();
      const dropdownRect = dropdown.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      // If dropdown would overflow right, align right
      if (btnRect.left + dropdownRect.width > windowWidth - 12) {
        dropdown.style.left = 'auto';
        dropdown.style.right = '0px';
        dropdown.style.transform = 'none';
      } else {
        dropdown.style.left = '50%';
        dropdown.style.right = 'auto';
        dropdown.style.transform = 'translateX(-50%)';
      }
    }
  });

  return <div className='recorder' style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 320, background: '#fafbfc', borderRadius: 12 }}>
    <div
      ref={containerRef}
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        padding: '16px 16px 160px 16px',
        overflowY: 'auto',
        overflowX: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
        background: '#fafbfc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {actionCards.map(card => (
        <ActionCard key={card.index} index={card.index} message={card.message} code={card.code} />
      ))}
      <div ref={messagesEndRef} />
    </div>
    <div style={{
      width: '100%',
      padding: '20px 0 16px 0',
      boxSizing: 'border-box',
      background: '#fff',
      borderTop: '1px solid #eee',
      zIndex: 100,
      position: 'fixed',
      left: 0,
      bottom: 0,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 18,
      maxWidth: '100vw',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, maxWidth: 480, width: '100%', margin: '0 auto' }}>
        {/* <ToolbarButton
          icon={paused ? 'play' : 'debug-pause'}
          title={paused ? 'Resume' : 'Pause'}
          toggled={mode === 'recording' || mode === 'recording-inspecting' || mode === 'assertingText' || mode === 'assertingVisibility'}
          onClick={() => {
            window.dispatch({ event: 'setMode', params: { mode: mode === 'none' || mode === 'standby' || mode === 'inspecting' ? 'recording' : 'standby' } });
          }}
          className="outline-button"
          style={{ width: 140, minWidth: 0, minHeight: 48, fontWeight: 700, fontSize: 18, border: '1.5px solid #d1d5db', color: '#23272f', background: '#fff', borderRadius: 14, boxShadow: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {paused ? 'Resume' : 'Pause'}
        </ToolbarButton> */}
        <ToolbarButton
          icon="trash"
          title="Delete"
          className="outline-button"
          style={{ width: '60%', minWidth: 0, minHeight: 48, fontWeight: 700, fontSize: 18, border: '1.5px solid #d1d5db', color: '#23272f', background: '#fff', borderRadius: 14, boxShadow: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => setShowDeleteConfirmation(true)}
        >
          Discard and Delete
        </ToolbarButton>
        {/* TODO: Add options functionality, DO NOT REMOVE */}
        {/* <div className="dropdown" style={{ position: 'relative' }}>
          <ToolbarButton
            ref={moreBtnRef}
            icon="more"
            title="More options"
            style={{ width: 60, minWidth: 0, minHeight: 48, fontSize: '22px', color: '#5b6dfa', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: 14, boxShadow: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                // Position above the button
                if (dropdownContent.classList.contains('show')) {
                  const buttonRect = e.currentTarget.getBoundingClientRect();
                  (dropdownContent as HTMLElement).style.bottom = `${buttonRect.height + 8}px`;
                  (dropdownContent as HTMLElement).style.top = 'auto';
                }
              }
            }}
          />
          <div ref={dropdownRef} className="dropdown-content" style={{ bottom: '52px', top: 'auto' }}>
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
        </div> */}
      </div>
      <ToolbarButton
        icon="check"
        title="Complete recording"
        onClick={() => {
          if (!isSaving) {
            setIsSaving(true);
            onSaveCode?.();
          }
        }}
        disabled={isSaving}
        className="large-filled-button"
        style={{ width: '92%', minWidth: 0, minHeight: 56, fontSize: 22, fontWeight: 800, borderRadius: 18, margin: '0 auto' }}
      >
        Complete Capture
      </ToolbarButton>
    </div>
    {isSaving && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 8,
          padding: '32px 40px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 360,
        }}>
          <div style={{
            width: 48,
            height: 48,
            border: '4px solid #e5e7eb',
            borderTopColor: '#5b6dfa',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: 20,
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#1a1a1a', textAlign: 'center' }}>Saving your recording...</div>
          <div style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
            Please wait, this may take a few seconds.
          </div>
        </div>
      </div>
    )}
    {showDeleteConfirmation && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: '40px 32px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: 320,
        }}>
          <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 16, color: '#23272f', textAlign: 'center' }}>Are you sure you want to delete?</div>
          <div style={{ fontSize: 16, color: '#666', marginBottom: 24, textAlign: 'center' }}>This will close the extension and clear all captured data.</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              style={{
                padding: '10px 24px',
                fontSize: 16,
                borderRadius: 8,
                border: '1.5px solid #d1d5db',
                background: '#fff',
                color: '#23272f',
                cursor: 'pointer',
                fontWeight: 500,
              }}
              onClick={() => setShowDeleteConfirmation(false)}
            >
              Cancel
            </button>
            <button
              style={{
                padding: '10px 24px',
                fontSize: 16,
                borderRadius: 8,
                border: 'none',
                background: '#ef4444',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 500,
              }}
              onClick={() => {
                setShowDeleteConfirmation(false);
                onDelete?.();
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
};
