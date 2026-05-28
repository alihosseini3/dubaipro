import type { ReactNode } from 'react';

/**
 * The visual builder must escape the standard admin padding container.
 * Negative margins pull it flush with the viewport edge inside the shell.
 */
export default function PageEditorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-6 -my-6 flex-1 lg:-mx-8 lg:-my-8">
      {children}
    </div>
  );
}
