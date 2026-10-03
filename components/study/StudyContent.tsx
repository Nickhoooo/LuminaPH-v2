import type { Ref } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

// Shared by newly generated guides and saved Library materials.
export default function StudyContent({ content, contentRef }: {
  content: string;
  contentRef?: Ref<HTMLDivElement>;
}) {
  return (
          <div ref={contentRef} className="study-reading min-w-0 break-words text-sm leading-7 text-stone-800 dark:text-stone-200 [&_h1]:mb-5 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-5 [&_h4]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_strong]:font-semibold [&_hr]:my-8 [&_hr]:border-stone-200 dark:[&_hr]:border-stone-700 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-300 dark:[&_blockquote]:border-emerald-700 [&_blockquote]:pl-4 [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-stone-900 [&_pre]:p-4 [&_pre]:text-stone-100 [&_code]:font-mono [&_code]:text-[0.85em] [&_a]:text-emerald-800 dark:[&_a]:text-emerald-200 [&_a]:underline">
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
              disallowedElements={["img"]}
              components={{
                table: ({ children }) => (
                  <div role="region" aria-label="Study guide table" tabIndex={0} className="my-5 overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700 focus-visible:outline-2 focus-visible:outline-emerald-800">
                    <table className="w-full min-w-[32rem] border-collapse text-left text-sm">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-emerald-50 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200">{children}</thead>,
                th: ({ children, style }) => <th style={style} className="border-b border-stone-200 dark:border-stone-700 px-4 py-3 align-top font-semibold">{children}</th>,
                td: ({ children, style }) => <td style={style} className="border-b border-stone-100 dark:border-stone-700 px-4 py-3 align-top">{children}</td>,
              }}
            >
              {content}
            </Markdown>
          </div>
  );
}
