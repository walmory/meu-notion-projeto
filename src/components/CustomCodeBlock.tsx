/* eslint-disable */
import { createReactBlockSpec } from '@blocknote/react';
import { useState, useCallback } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markup'; // HTML
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism-okaidia.css'; // Dark theme (Monokai-like)
import { Copy, Check } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CodeBlockRenderer = (props: { block: any; editor: any }) => {
  const { block, editor } = props;
  const [copied, setCopied] = useState(false);

  const handleCodeChange = (newCode: string) => {
    editor.updateBlock(block, {
      type: 'codeBlock',
      props: { ...block.props, code: newCode },
    });
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    editor.updateBlock(block, {
      type: 'codeBlock',
      props: { ...block.props, language: e.target.value },
    });
  };

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(block.props.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [block.props.code]);

  const highlightCode = (code: string) => {
    let lang = block.props.language;
    if (lang === 'html') lang = 'markup';
    if (lang === 'text') return code;
    
    const grammar = Prism.languages[lang] || Prism.languages.javascript;
    return Prism.highlight(code, grammar, lang);
  };

  return (
    <div className="group relative my-4 rounded-lg bg-[#1e1e1e] p-4 border border-[#333] w-full max-w-full overflow-hidden box-border">
      {/* Top Bar: Language Selector & Copy Button */}
      <div className="mb-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <select
          value={block.props.language}
          onChange={handleLanguageChange}
          className="bg-[#2d2d2d] text-[#a3a3a3] text-xs px-2 py-1 rounded outline-none cursor-pointer border border-[#3f3f3f] hover:text-white"
          contentEditable={false}
        >
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
          <option value="sql">SQL</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="json">JSON</option>
          <option value="text">Plain Text</option>
        </select>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 bg-[#2d2d2d] hover:bg-[#3f3f3f] text-[#a3a3a3] hover:text-white text-xs px-2 py-1 rounded transition-colors cursor-pointer"
          contentEditable={false}
          type="button"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>

      {/* Code Editor */}
      <div className="text-sm font-mono text-white overflow-x-auto w-full box-border">
        <Editor
          value={block.props.code}
          onValueChange={handleCodeChange}
          highlight={highlightCode}
          padding={0}
          className="!outline-none min-h-[40px] w-full max-w-full box-border"
          style={{
            fontFamily: '"Fira Code", "JetBrains Mono", monospace',
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap',
          }}
          textareaClassName="!outline-none resize-none max-w-full"
          onKeyDown={(e) => {
            // Allow entering line breaks and stop propagation to BlockNote
            if (e.key === 'Enter') {
              e.stopPropagation();
            }
            // Let standard arrows move naturally inside the code editor
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
              e.stopPropagation();
            }
          }}
        />
      </div>
    </div>
  );
};

export const CustomCodeBlock = createReactBlockSpec(
  {
    type: 'codeBlock',
    propSchema: {
      language: {
        default: 'javascript',
        values: ['javascript', 'typescript', 'python', 'sql', 'html', 'css', 'json', 'text'],
      },
      code: {
        default: '',
      },
    },
    content: 'none',
  },
  {
    render: CodeBlockRenderer,
  }
);
