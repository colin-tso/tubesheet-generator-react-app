import { createContext, useContext } from "react";

// Numbering contexts for the docs' cross-referenceable elements. See
// DocsRegistry.tsx for how these maps get populated (a document-order scan
// over `[data-eq-id]` / `[data-table-id]`) and why equations and tables
// need one each.
export const EquationNumbersContext = createContext<Map<string, number> | null>(null);
export const TableNumbersContext = createContext<Map<string, number> | null>(null);

export function useEquationNumber(id: string): number | null {
    const numbers = useContext(EquationNumbersContext);
    return numbers?.get(id) ?? null;
}

export function useTableNumber(id: string): number | null {
    const numbers = useContext(TableNumbersContext);
    return numbers?.get(id) ?? null;
}
