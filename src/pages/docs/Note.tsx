import type { ReactNode } from "react";

export function Note({ children }: { children: ReactNode }) {
    return <div className="docs-note">{children}</div>;
}
