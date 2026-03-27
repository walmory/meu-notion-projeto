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
import { Copy, Check, Sparkles, Loader2 } from 'lucide-react';
import { CodeDiffViewer } from './CodeDiffViewer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CodeBlockRenderer = (props: { block: any; editor: any }) => {
  const { block, editor } = props;
  const [copied, setCopied] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiModifiedCode, setAiModifiedCode] = useState<string | null>(null);

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

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    
    setIsGenerating(true);
    // Simulate AI generation delay
    setTimeout(() => {
      const promptLower = aiPrompt.toLowerCase();
      let generated = block.props.code;
      
      // Simple mockup logic for demonstration
      if (promptLower.includes('refactor') || promptLower.includes('clean')) {
        generated = `// Refactored by AI\n${block.props.code}\n\n// Added some cleanups...`;
      } else if (promptLower.includes('comment') || promptLower.includes('explain')) {
        generated = `/**\n * AI Generated Explanation\n * This code does something awesome.\n */\n${block.props.code}`;
      } else {
        generated = `${block.props.code}\n\n// AI suggested changes based on: "${aiPrompt}"\nconsole.log("Hello from AI!");`;
      }

      setAiModifiedCode(generated);
      setIsGenerating(false);
    }, 1500);
  };

  const acceptAiChanges = () => {
    if (aiModifiedCode) {
      handleCodeChange(aiModifiedCode);
    }
    setAiModifiedCode(null);
    setIsAiMode(false);
    setAiPrompt('');
  };

  const rejectAiChanges = () => {
    setAiModifiedCode(null);
    setIsAiMode(false);
    setAiPrompt('');
  };

  if (aiModifiedCode) {
    return (
      <div className="my-4 w-full">
        <CodeDiffViewer
          original={block.props.code}
          modified={aiModifiedCode}
          language={block.props.language}
          onAccept={acceptAiChanges}
          onReject={rejectAiChanges}
        />
      </div>
    );
  }

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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAiMode(!isAiMode)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors cursor-pointer border ${isAiMode ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-[#2d2d2d] hover:bg-[#3f3f3f] text-[#a3a3a3] hover:text-white border-transparent'}`}
            contentEditable={false}
            type="button"
          >
            <Sparkles size={14} />
            Ask AI
          </button>
          
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 bg-[#2d2d2d] hover:bg-[#3f3f3f] text-[#a3a3a3] hover:text-white text-xs px-2 py-1 rounded transition-colors cursor-pointer border border-transparent"
            contentEditable={false}
            type="button"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
      </div>

      {/* AI Prompt Input */}
      {isAiMode && (
        <form onSubmit={handleAiSubmit} className="mb-3 flex items-center gap-2" contentEditable={false}>
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Ask AI to edit this code..."
            className="flex-1 bg-[#2d2d2d] border border-[#3f3f3f] text-sm text-white px-3 py-1.5 rounded outline-none focus:border-purple-500/50 transition-colors"
            disabled={isGenerating}
          />
          <button
            type="submit"
            disabled={!aiPrompt.trim() || isGenerating}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : 'Generate'}
          </button>
        </form>
      )}

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
