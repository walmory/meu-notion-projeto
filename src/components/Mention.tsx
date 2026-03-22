import { createReactInlineContentSpec } from "@blocknote/react";
import { useRouter } from "next/navigation";

const MentionComponent = (props: {
  inlineContent: { props: { documentId: string; documentTitle: string; documentIcon: string } };
}) => {
  const router = useRouter();
  const { documentId, documentTitle, documentIcon } = props.inlineContent.props;

  return (
    <a
      href={`/documents/${documentId}`}
      className="inline-flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded px-1.5 py-0.5 mx-0.5 cursor-pointer transition-colors group relative border border-blue-500/20 align-middle no-underline"
      onClick={(e) => {
        e.preventDefault();
        router.push(`/documents/${documentId}`);
      }}
      contentEditable={false}
    >
      <span>{documentIcon || '📄'}</span>
      {documentTitle || 'Untitled'}
      <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#1a1a1a] text-[#a3a3a3] text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-[9999] border border-[#2c2c2c]">
        Ir para o documento
      </span>
    </a>
  );
};

export const Mention = createReactInlineContentSpec(
  {
    type: "mention",
    propSchema: {
      userId: { default: "unknown" },
      userName: { default: "User" },
      documentId: { default: "unknown" },
      documentTitle: { default: "Untitled" },
      documentIcon: { default: "📄" },
    },
    content: "none",
  },
  {
    render: MentionComponent,
  }
);
