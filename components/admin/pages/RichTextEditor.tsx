'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { useCallback } from 'react';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  dir?: 'ltr' | 'rtl';
  minHeight?: number;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start writing…',
  dir = 'ltr',
  minHeight = 240,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        dir,
        class: 'prose prose-slate max-w-none focus:outline-none',
        style: `min-height:${minHeight}px; padding: 1rem`,
      },
    },
    immediatelyRender: false,
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt('URL', prev ?? 'https://');
    if (href === null) return;
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const src = window.prompt('Image URL');
    if (!src) return;
    editor.chain().focus().setImage({ src }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-slate-100 bg-slate-50 px-2 py-1.5"
        onMouseDown={(e) => e.preventDefault()}
      >
        <ToolbarGroup>
          <Btn
            active={editor.isActive('heading', { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            title="Heading 1"
          >
            H1
          </Btn>
          <Btn
            active={editor.isActive('heading', { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            title="Heading 2"
          >
            H2
          </Btn>
          <Btn
            active={editor.isActive('heading', { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            title="Heading 3"
          >
            H3
          </Btn>
        </ToolbarGroup>

        <Sep />

        <ToolbarGroup>
          <Btn
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <b>B</b>
          </Btn>
          <Btn
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <i>I</i>
          </Btn>
          <Btn
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strike"
          >
            <s>S</s>
          </Btn>
          <Btn
            active={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline code"
          >
            {'<>'}
          </Btn>
        </ToolbarGroup>

        <Sep />

        <ToolbarGroup>
          <Btn
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            •—
          </Btn>
          <Btn
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          >
            1—
          </Btn>
          <Btn
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          >
            ❝
          </Btn>
          <Btn
            active={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code block"
          >
            {'{ }'}
          </Btn>
        </ToolbarGroup>

        <Sep />

        <ToolbarGroup>
          <Btn
            active={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            title="Align left"
          >
            ≡
          </Btn>
          <Btn
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            title="Align center"
          >
            ≡
          </Btn>
          <Btn
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            title="Align right (RTL)"
          >
            ≡
          </Btn>
        </ToolbarGroup>

        <Sep />

        <ToolbarGroup>
          <Btn
            active={editor.isActive('link')}
            onClick={setLink}
            title="Link"
          >
            🔗
          </Btn>
          <Btn active={false} onClick={addImage} title="Image">
            🖼
          </Btn>
        </ToolbarGroup>

        <Sep />

        <ToolbarGroup>
          <Btn
            active={false}
            onClick={() => editor.chain().focus().undo().run()}
            title="Undo"
          >
            ↩
          </Btn>
          <Btn
            active={false}
            onClick={() => editor.chain().focus().redo().run()}
            title="Redo"
          >
            ↪
          </Btn>
        </ToolbarGroup>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Sep() {
  return <div className="mx-1 h-5 w-px bg-slate-200" />;
}

function Btn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs font-medium transition
        ${active
          ? 'bg-orange-500 text-white'
          : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
        }`}
    >
      {children}
    </button>
  );
}
