import Editor, { type OnMount } from '@monaco-editor/react';
import { Loader2, Code2 } from 'lucide-react';
import type { SupportedLanguageId } from '../../types';
import { getLanguageDefinition } from '../../constants/languages';

interface MonacoEditorPaneProps {
  code: string;
  language: SupportedLanguageId;
  onChange: (value: string | undefined) => void;
  onMount?: OnMount;
}

export const MonacoEditorPane: React.FC<MonacoEditorPaneProps> = ({
  code,
  language,
  onChange,
  onMount,
}) => {
  const currentLang = getLanguageDefinition(language);

  const editorOptions = {
    theme: 'vs-dark',
    fontSize: 13.5,
    fontFamily: "'JetBrains Mono', Consolas, 'Fira Code', monospace",
    fontLigatures: true,
    tabSize: 4,
    insertSpaces: true,
    automaticLayout: true,
    lineNumbers: 'on' as const,
    lineNumbersMinChars: 3,
    folding: true,
    autoIndent: 'full' as const,
    formatOnPaste: true,
    formatOnType: true,
    minimap: {
      enabled: true,
      scale: 1,
      renderCharacters: false,
    },
    scrollBeyondLastLine: false,
    scrollbar: {
      vertical: 'visible' as const,
      horizontal: 'visible' as const,
      useShadows: false,
      verticalScrollbarSize: 9,
      horizontalScrollbarSize: 9,
    },
    renderLineHighlight: 'all' as const,
    overviewRulerBorder: false,
    cursorBlinking: 'smooth' as const,
    cursorSmoothCaretAnimation: 'on' as const,
    smoothScrolling: true,
    padding: {
      top: 14,
      bottom: 14,
    },
  };

  return (
    <div className="relative flex-1 min-h-[300px] h-full bg-[#1e1e1e] flex flex-col overflow-hidden">
      {/* Editor Sub-header Bar */}
      <div className="bg-[#181818] border-b border-slate-800/80 px-4 py-1.5 flex items-center justify-between text-xs text-slate-400 font-mono shrink-0">
        <div className="flex items-center gap-2">
          <Code2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300 font-medium">
            solution{currentLang.extension}
          </span>
          <span className="text-[10px] text-slate-500">
            ({currentLang.monacoLanguage})
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>UTF-8</span>
          <span>Tab: 4 Spaces</span>
        </div>
      </div>

      {/* Monaco Container */}
      <div className="flex-1 w-full h-full min-h-0 relative">
        <Editor
          height="100%"
          language={currentLang.monacoLanguage}
          value={code}
          theme="vs-dark"
          onChange={onChange}
          onMount={onMount}
          options={editorOptions}
          loading={
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#1e1e1e] text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs font-mono">Loading Monaco Editor...</span>
            </div>
          }
        />
      </div>
    </div>
  );
};
