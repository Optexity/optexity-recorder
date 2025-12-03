/**
 * Copyright (c) Rui Figueira.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import type { CallLog, ElementInfo, Mode, Source } from '@recorder/recorderTypes';
import { Recorder } from '@recorder/recorder';
import type { CrxSettings } from './settings';
import { addSettingsChangedListener, defaultSettings, loadSettings, removeSettingsChangedListener } from './settings';
import ModalContainer from 'react-modal-promise';
import './crxRecorder.css';
import './form.css';
import { TaskDescription } from './taskDescription';
import { APIKeyInputScreen } from './apiKeyInputScreen';
import './apiKeyInputScreen.css';

// Global Maps to store eval pages and contents
const globalEvalPages = new Map<string, { [key: string]: any }>();
// const globalContents = new Map<string, string>();

function setElementPicked(elementInfo: ElementInfo, userGesture?: boolean) {
  window.playwrightElementPicked(elementInfo, userGesture);
}

function setRunningFileId(fileId: string) {
  window.playwrightSetRunningFile(fileId);
}

// function download(filename: string, text: string) {
//   const blob = new Blob([text], { type: 'text/plain' });
//   const url = URL.createObjectURL(blob);
//   try {
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = filename;
//     a.click();
//   } finally {
//     URL.revokeObjectURL(url);
//   }
// }

// const codegenFilenames: Record<string, string> = {
//   'javascript': 'example.js',
//   'playwright-test': 'example.spec.ts',
//   'java-junit': 'TestExample.java',
//   'java': 'Example.java',
//   'python-pytest': 'test_example.py',
//   'python': 'example.py',
//   'python-async': 'example.py',
//   'csharp-mstest': 'Tests.cs',
//   'csharp-nunit': 'Tests.cs',
//   'csharp': 'Example.cs',
// };

export const CrxRecorder: React.FC = ({
}) => {
  const [settings, setSettings] = React.useState<CrxSettings>(defaultSettings);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [paused, setPaused] = React.useState(false);
  const [log, setLog] = React.useState(new Map<string, CallLog>());
  const [mode, setMode] = React.useState<Mode>('none');
  const [selectedFileId, setSelectedFileId] = React.useState<string>(defaultSettings.targetLanguage);
  const [showRecorder, setShowRecorder] = React.useState(false);
  const [showWelcomeScreen, setShowWelcomeScreen] = React.useState(false);
  const [showSavedOverlay, setShowSavedOverlay] = React.useState(false);
  const [showErrorPopup, setShowErrorPopup] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [recorderKey, setRecorderKey] = React.useState(0);
  const [apiKey, setApiKey] = React.useState('');

  React.useEffect(() => {
    // Check localStorage for API key on mount
    const storedApiKey = localStorage.getItem('optexity_api_key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setShowWelcomeScreen(true);
    }

    const port = chrome.runtime.connect({ name: 'recorder' });
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'OPTEXITY_EVAL_PAGE') {
        (async () => {
          if (message.eval_page) {
            globalEvalPages.set(message.file_id, message.eval_page);
            // globalContents.set(message.file_id, message.content);
            sendResponse({ success: true });
          } else {
            console.log('message.eval_page is null');
            sendResponse({ success: false });
          }
        })();

        return true; // ✅ Important to keep the message channel open for async response
      }
    });
    const onMessage = (msg: any) => {
      if (!('type' in msg) || msg.type !== 'recorder')
        return;

      switch (msg.method) {
        case 'setPaused': setPaused(msg.paused); break;
        case 'setMode': setMode(msg.mode); break;
        case 'setSources': setSources(msg.sources); break;
        case 'resetCallLogs': setLog(new Map()); break;
        case 'updateCallLogs': setLog(log => {
          const newLog = new Map<string, CallLog>(log);
          for (const callLog of msg.callLogs) {
            callLog.reveal = !log.has(callLog.id);
            newLog.set(callLog.id, callLog);
          }
          return newLog;
        }); break;
        case 'setRunningFile': setRunningFileId(msg.file); break;
        case 'elementPicked': setElementPicked(msg.elementInfo, msg.userGesture); break;
      }
    };
    port.onMessage.addListener(onMessage);

    window.dispatch = async (data: any) => {
      port.postMessage({ type: 'recorderEvent', ...data });
      if (data.event === 'fileChanged')
        setSelectedFileId(data.params.file);
    };
    loadSettings().then(settings => {
      setSettings(settings);
      setSelectedFileId(settings.targetLanguage);
    }).catch(() => {});

    addSettingsChangedListener(setSettings);

    return () => {
      removeSettingsChangedListener(setSettings);
      port.disconnect();
    };
  }, []);

  const source = React.useMemo(() => sources.find(s => s.id === selectedFileId), [sources, selectedFileId]);

  // const requestStorageState = React.useCallback(() => {
  //   if (!settings.experimental)
  //     return;

  //   chrome.runtime.sendMessage({ event: 'storageStateRequested' }).then(storageState => {
  //     const fileSuffix = generateDatetimeSuffix();
  //     download(`storageState-${fileSuffix}.json`, JSON.stringify(storageState, null, 2));
  //   });
  // }, [settings]);

  // const showPreferences = React.useCallback(() => {
  //   const modal = createModal(({ isOpen, onResolve }) =>
  //     <Dialog title='Preferences' isOpen={isOpen} onClose={onResolve}>
  //       <PreferencesForm />
  //     </Dialog>
  //   );
  //   modal().catch(() => {});
  // }, []);

  const saveCode = React.useCallback(() => {
    if (!settings.experimental)
      return;
    const code = source?.text;
    if (!code)
      return;

    console.log('making api call : ');
    const evalPagesData = Object.fromEntries(Array.from(globalEvalPages.entries()));

    // Create compressed payload for eval_pages
    const payload = { eval_pages: evalPagesData };
    const jsonString = JSON.stringify(payload);

    // Don't await - let it run in background
    (async () => {
      try {
        const stream = new Blob([jsonString]).stream();
        const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
        const compressedBlob = await new Response(compressedStream).blob();
        console.log(`Compressed size: ${compressedBlob.size} bytes`);
        const formData = new FormData();
        formData.append('code_file', new File([code], 'generated_code.py', { type: 'text/plain' }));
        formData.append('compressed_data', compressedBlob, 'eval_pages.json.gz');

        const response = await fetch('https://api.optexity.com/api/v1/save_demo', {
          method: 'POST',
          body: formData,
          headers: {
            'X-Api-Key': apiKey,
          },
        });

        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);

        await response.json();
        setShowSavedOverlay(true);
      } catch (error) {
        setErrorMessage(String(error) || 'An unknown error occurred');
        setShowErrorPopup(true);
      } finally {
        globalEvalPages.clear();
        setSources([]);
        setPaused(false);
        setLog(new Map<string, CallLog>());
        setMode('none');
        setSelectedFileId(defaultSettings.targetLanguage);
        setRecorderKey(prev => prev + 1);
        setTimeout(() => {
          window.close();
          window.open('https://dashboard.optexity.com', '_blank');
        }, 10000);
      }
    })();

    // const filename = codegenFilenames[selectedFileId];
    // download(filename, code);
  }, [settings, source, apiKey]);

  React.useEffect(() => {
    if (!settings.experimental)
      return;

    const keydownHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveCode();
      }
    };
    window.addEventListener('keydown', keydownHandler);

    return () => {
      window.removeEventListener('keydown', keydownHandler);
    };
  }, [selectedFileId, settings, saveCode]);

  const dispatchEditedCode = React.useCallback((code: string) => {
    window.dispatch({ event: 'codeChanged', params: { code } });
  }, []);

  const dispatchCursorActivity = React.useCallback((position: { line: number }) => {
    window.dispatch({ event: 'cursorActivity', params: { position } });
  }, []);

  const handleStartCapturing = (description: string) => {
    setShowRecorder(true);
    setRecorderKey(prev => prev + 1);
  };

  const handleDelete = React.useCallback(() => {
    globalEvalPages.clear();
    // globalContents.clear();
    // Clear all state first
    setSources([]);
    setPaused(false);
    setLog(new Map<string, CallLog>());
    setMode('none');
    setSelectedFileId(defaultSettings.targetLanguage);
    setRecorderKey(prev => prev + 1);

    // Close the extension window
    window.close();
  }, []);

  const handleLogout = React.useCallback(() => {
    localStorage.removeItem('optexity_api_key');
    setApiKey('');
    setShowWelcomeScreen(false);
  }, []);

  if (!showWelcomeScreen)
    return <APIKeyInputScreen onStartCapturing={key => { setApiKey(key); localStorage.setItem('optexity_api_key', key); setShowWelcomeScreen(true); }} />;

  if (!showRecorder && showWelcomeScreen)
    return <TaskDescription onStartCapturing={handleStartCapturing} onLogout={handleLogout} />;

  return <>
    <ModalContainer />

    <div className='recorder' style={{ position: 'relative' }}>
      {/* {settings.experimental && <>
        <Toolbar>
          <ToolbarButton icon='save' title='Save' disabled={false} onClick={saveCode}>Save</ToolbarButton>
          <div style={{ flex: 'auto' }}></div>
          <div className='dropdown'>
            <ToolbarButton icon='tools' title='Tools' disabled={false} onClick={() => {}}></ToolbarButton>
            <div className='dropdown-content right-align'>
              <a href='#' onClick={requestStorageState}>Download storage state</a>
            </div>
          </div>
          <ToolbarSeparator />
          <ToolbarButton icon='settings-gear' title='Preferences' onClick={showPreferences}></ToolbarButton>
        </Toolbar>
      </>} */}
      <Recorder
        key={recorderKey}
        sources={sources}
        paused={paused}
        log={log}
        mode={mode}
        onEditedCode={dispatchEditedCode}
        onCursorActivity={dispatchCursorActivity}
        onSaveCode={saveCode}
        onDelete={handleDelete}
      />
      {showSavedOverlay && (
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
            maxWidth: 400,
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#1a1a1a', textAlign: 'center' }}>Recording saved successfully</div>
            <div style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
              Redirecting to dashboard in 10 seconds...
            </div>
          </div>
        </div>
      )}
      {showErrorPopup && (
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
            maxWidth: 400,
            borderTop: '3px solid #dc2626',
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#1a1a1a', textAlign: 'center' }}>Error saving recording</div>
            {errorMessage && <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 12, textAlign: 'center', fontFamily: 'monospace' }}>{errorMessage}</div>}
            <div style={{ fontSize: 14, color: '#666', marginBottom: 16, textAlign: 'center' }}>
              Please try again or contact <span style={{ color: '#1a1a1a' }}>founders@optexity.com</span>
            </div>
            <div style={{ fontSize: 13, color: '#999', textAlign: 'center' }}>
              Redirecting to dashboard in 10 seconds...
            </div>
          </div>
        </div>
      )}
    </div>
  </>;
};
