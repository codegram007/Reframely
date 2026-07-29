import { useEffect, useRef } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import { useThemeStore } from '@/stores/theme-store';

/**
 * Wire Monaco to the LOCALLY bundled package + Vite-built web workers,
 * instead of @monaco-editor/react's default CDN loader. This keeps the
 * Code View working offline and pins the version we installed.
 */
declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

let configured = false;
function configureMonaco() {
  if (configured) return;
  configured = true;
  window.MonacoEnvironment = {
    getWorker(_workerId, label) {
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
      return new editorWorker();
    },
  };
  loader.config({ monaco });
}

const THEME_LIGHT = 'vs';
const THEME_DARK = 'vs-dark';

/**
 * A thin Monaco wrapper used by the Code View. Deliberately minimal props
 * so a future swap (or the read-only ↔ editable toggle) is trivial:
 * `value`, `language`, `readOnly`, `onChange`. Chrome (minimap, rulers) is
 * tuned down so the pane reads like a focused code surface, not an IDE.
 */
export function CodePane({
  value,
  language,
  readOnly,
  onChange,
}: {
  value: string;
  language: 'html' | 'css';
  readOnly: boolean;
  onChange?: (value: string) => void;
}) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    configureMonaco();
  }, []);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  return (
    <Editor
      value={value}
      language={language}
      theme={theme === 'dark' ? THEME_DARK : THEME_LIGHT}
      onMount={handleMount}
      onChange={(v) => onChange?.(v ?? '')}
      options={{
        readOnly,
        domReadOnly: readOnly,
        minimap: { enabled: false },
        lineNumbers: 'on',
        fontSize: 12.5,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        wrappingStrategy: 'advanced',
        renderLineHighlight: readOnly ? 'none' : 'line',
        folding: true,
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 10, bottom: 10 },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        overviewRulerLanes: 0,
        stickyScroll: { enabled: false },
      }}
    />
  );
}
