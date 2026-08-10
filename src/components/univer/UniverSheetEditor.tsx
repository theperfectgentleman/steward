"use client";

import { useState, useEffect } from "react";
import { Plus, Table, Download, Calculator } from "lucide-react";

type SheetRow = (string | number | null)[];
type SheetData = {
  sheetNames: string[];
  sheets: Record<string, SheetRow[]>;
};

export function UniverSheetEditor({
  initialData,
  onChange,
  readOnly = false,
}: {
  initialData?: Record<string, unknown> | null;
  onChange: (updatedJson: Record<string, unknown>, plainText: string) => void;
  readOnly?: boolean;
}) {
  const [sheets, setSheets] = useState<Record<string, SheetRow[]>>(() => {
    if (initialData?.sheets && typeof initialData.sheets === "object") {
      return initialData.sheets as Record<string, SheetRow[]>;
    }
    return {
      "Sheet 1": [
        ["Category", "Q1 Budget", "Q2 Budget", "Total", "Notes"],
        ["Equipment & Maintenance", 1200, 1500, "=SUM(B2:C2)", "Approved"],
        ["Events & Hospitality", 800, 950, "=SUM(B3:C3)", "Pending review"],
        ["Outreach & Welfare", 2000, 2500, "=SUM(B4:C4)", "Active"],
      ],
    };
  });

  const [activeSheet, setActiveSheet] = useState<string>("Sheet 1");
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [formulaValue, setFormulaValue] = useState("");

  const sheetNames = Object.keys(sheets);
  const rows = sheets[activeSheet] || [];
  const colCount = Math.max(8, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)));

  useEffect(() => {
    if (initialData?.sheetNames && Array.isArray(initialData.sheetNames) && initialData.sheetNames[0]) {
      setActiveSheet(initialData.sheetNames[0] as string);
    }
  }, [initialData]);

  const updateCell = (rIdx: number, cIdx: number, val: string | number) => {
    if (readOnly) return;
    const currentRows = [...(sheets[activeSheet] || [])];
    while (currentRows.length <= rIdx) {
      currentRows.push([]);
    }
    const targetRow = [...(currentRows[rIdx] || [])];
    while (targetRow.length <= cIdx) {
      targetRow.push("");
    }
    targetRow[cIdx] = val;
    currentRows[rIdx] = targetRow;

    const newSheets = { ...sheets, [activeSheet]: currentRows };
    setSheets(newSheets);

    // Build plain text representation
    const textLines: string[] = [];
    for (const sName of Object.keys(newSheets)) {
      textLines.push(`--- ${sName} ---`);
      for (const row of newSheets[sName]) {
        if (Array.isArray(row)) textLines.push(row.filter(Boolean).join(" | "));
      }
    }

    onChange(
      { type: "SPREADSHEET", sheetNames: Object.keys(newSheets), sheets: newSheets },
      textLines.join("\n"),
    );
  };

  const addRow = () => {
    if (readOnly) return;
    const currentRows = [...(sheets[activeSheet] || [])];
    currentRows.push(Array(colCount).fill(""));
    const newSheets = { ...sheets, [activeSheet]: currentRows };
    setSheets(newSheets);
  };

  const addSheet = () => {
    if (readOnly) return;
    const newName = `Sheet ${sheetNames.length + 1}`;
    const newSheets = {
      ...sheets,
      [newName]: [["Item", "Amount", "Status"]],
    };
    setSheets(newSheets);
    setActiveSheet(newName);
  };

  const getColHeader = (index: number) => {
    return String.fromCharCode(65 + index);
  };

  return (
    <div className="w-full flex-1 rounded-2xl border border-charcoal/15 bg-white p-4 shadow-sm space-y-3">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal/10 pb-3">
        <div className="flex items-center gap-2 text-primary font-bold text-sm">
          <Table className="h-4 w-4" />
          <span>Excel Spreadsheet Engine</span>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded-lg border border-charcoal/15 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-charcoal hover:bg-slate-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </button>
          )}
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            Formulas & Grid Active
          </span>
        </div>
      </div>

      {/* Formula Bar */}
      <div className="flex items-center gap-2 rounded-xl border border-charcoal/15 bg-slate-50/80 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-1 font-semibold text-charcoal/70 shrink-0">
          <Calculator className="h-3.5 w-3.5 text-primary" />
          <span>
            {selectedCell
              ? `${getColHeader(selectedCell.c)}${selectedCell.r + 1}`
              : "fx"}
          </span>
        </div>
        <input
          type="text"
          value={formulaValue}
          onChange={(e) => {
            setFormulaValue(e.target.value);
            if (selectedCell) {
              updateCell(selectedCell.r, selectedCell.c, e.target.value);
            }
          }}
          placeholder={selectedCell ? "Enter value or formula (=SUM...)" : "Select a cell to edit value or formula"}
          disabled={!selectedCell || readOnly}
          className="flex-1 bg-transparent outline-none text-charcoal font-mono"
        />
      </div>

      {/* Sheet Grid Canvas */}
      <div className="overflow-x-auto rounded-xl border border-charcoal/15 max-h-[420px] overflow-y-auto">
        <table className="w-full border-collapse text-left text-xs font-sans">
          <thead>
            <tr className="bg-slate-100/80 text-charcoal/70 font-semibold border-b border-charcoal/15 select-none">
              <th className="w-10 border-r border-charcoal/15 px-2 py-1.5 text-center">#</th>
              {Array.from({ length: colCount }).map((_, cIdx) => (
                <th
                  key={cIdx}
                  className="min-w-[110px] border-r border-charcoal/15 px-3 py-1.5 text-center uppercase"
                >
                  {getColHeader(cIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="border-b border-charcoal/10 hover:bg-slate-50/50">
                <td className="bg-slate-50 border-r border-charcoal/15 px-2 py-1.5 text-center font-mono text-muted select-none">
                  {rIdx + 1}
                </td>
                {Array.from({ length: colCount }).map((_, cIdx) => {
                  const rawVal = row[cIdx] ?? "";
                  const isSelected = selectedCell?.r === rIdx && selectedCell?.c === cIdx;
                  return (
                    <td
                      key={cIdx}
                      onClick={() => {
                        setSelectedCell({ r: rIdx, c: cIdx });
                        setFormulaValue(String(rawVal));
                      }}
                      className={`border-r border-charcoal/10 p-0 transition-colors ${
                        isSelected ? "ring-2 ring-primary ring-inset bg-primary/5" : ""
                      }`}
                    >
                      <input
                        type="text"
                        value={String(rawVal)}
                        disabled={readOnly}
                        onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                        onFocus={() => {
                          setSelectedCell({ r: rIdx, c: cIdx });
                          setFormulaValue(String(rawVal));
                        }}
                        className="w-full bg-transparent px-2.5 py-1.5 outline-none text-charcoal font-sans"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet Tabs */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1">
          {sheetNames.map((sName) => (
            <button
              key={sName}
              type="button"
              onClick={() => setActiveSheet(sName)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeSheet === sName
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-charcoal hover:bg-slate-200"
              }`}
            >
              {sName}
            </button>
          ))}
          {!readOnly && (
            <button
              type="button"
              onClick={addSheet}
              className="p-1 rounded-lg border border-charcoal/15 text-charcoal hover:bg-slate-100"
              title="Add sheet tab"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
