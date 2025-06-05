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
import type { CallLog, ElementInfo, Mode, Source } from '@recorder/recorderTypes';
import { Recorder } from '@recorder/recorder';
import type { CrxSettings } from './settings';
import { addSettingsChangedListener, defaultSettings, loadSettings, removeSettingsChangedListener } from './settings';
import ModalContainer from 'react-modal-promise';
import './crxRecorder.css';
import './form.css';
import { TaskDescription } from './taskDescription';

function setElementPicked(elementInfo: ElementInfo, userGesture?: boolean) {
  window.playwrightElementPicked(elementInfo, userGesture);
}

function setRunningFileId(fileId: string) {
  window.playwrightSetRunningFile(fileId);
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

const codegenFilenames: Record<string, string> = {
  'javascript': 'example.js',
  'playwright-test': 'example.spec.ts',
  'java-junit': 'TestExample.java',
  'java': 'Example.java',
  'python-pytest': 'test_example.py',
  'python': 'example.py',
  'python-async': 'example.py',
  'csharp-mstest': 'Tests.cs',
  'csharp-nunit': 'Tests.cs',
  'csharp': 'Example.cs',
};

export const CrxRecorder: React.FC = ({
}) => {
  const [settings, setSettings] = React.useState<CrxSettings>(defaultSettings);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [paused, setPaused] = React.useState(false);
  const [log, setLog] = React.useState(new Map<string, CallLog>());
  const [mode, setMode] = React.useState<Mode>('none');
  const [selectedFileId, setSelectedFileId] = React.useState<string>(defaultSettings.targetLanguage);
  const [showRecorder, setShowRecorder] = React.useState(false);
  const [showSavedOverlay, setShowSavedOverlay] = React.useState(false);
  const [recorderKey, setRecorderKey] = React.useState(0);

  React.useEffect(() => {
    const port = chrome.runtime.connect({ name: 'recorder' });
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
    const filename = codegenFilenames[selectedFileId];
    download(filename, code);
    setShowSavedOverlay(true);
  }, [settings, source, selectedFileId]);

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

  if (!showRecorder)
    return <TaskDescription onStartCapturing={handleStartCapturing} />;

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
      />
      {showSavedOverlay && (
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
            <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 16, color: '#23272f' }}>Code has been successfully saved</div>
            <button
              style={{
                marginTop: 16,
                padding: '10px 24px',
                fontSize: 16,
                borderRadius: 8,
                border: 'none',
                background: '#5b6dfa',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 500,
              }}
              onClick={() => {
                setShowSavedOverlay(false);
                setShowRecorder(false);
                setSources([]);
                setPaused(false);
                setLog(new Map<string, CallLog>());
                setMode('none');
                setSelectedFileId(defaultSettings.targetLanguage);
                setRecorderKey(prev => prev + 1);
              }}
            >
              Record another workflow
            </button>
          </div>
        </div>
      )}
    </div>
  </>;
};
