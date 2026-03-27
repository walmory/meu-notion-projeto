import React from 'react';
import { DiffEditor } from '@monaco-editor/react';

interface CodeDiffViewerProps {
  original: string;
  modified: string;
  language?: string;
  onAccept: () => void;
  onReject: () => void;
}

export function CodeDiffViewer({
  original,
  modified,
  language = 'javascript',
  onAccept,
  onReject
}: CodeDiffViewerProps) {
  return (
    <div className="flex flex-col w-full border border-[#3f3f3f] rounded-lg overflow-hidden bg-[#1e1e1e]">
      <div className="flex items-center justify-between p-2 bg-[#2d2d2d] border-b border-[#3f3f3f]">
        <div className="text-xs text-[#a3a3a3] font-medium flex gap-4 px-2">
          <span className="text-red-400">Original</span>
          <span className="text-green-400">Modified (AI)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            className="px-3 py-1 text-xs rounded bg-transparent border border-[#3f3f3f] text-[#a3a3a3] hover:text-white hover:bg-white/5 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={onAccept}
            className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
      <div className="h-[300px] w-full">
        <DiffEditor
          original={original}
          modified={modified}
          language={language === 'text' ? 'plaintext' : language}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontFamily: '"Fira Code", "JetBrains Mono", monospace',
            fontSize: 13,
            lineHeight: 20,
          }}
        />
      </div>
    </div>
  );
}
