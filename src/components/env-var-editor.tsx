"use client";

import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { ClipboardEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EnvVar {
  key: string;
  value: string;
}

interface EnvVarEditorProps {
  value: EnvVar[];
  onChange: (vars: EnvVar[]) => void;
}

function parseEnvContent(text: string): EnvVar[] {
  const results: EnvVar[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let val = trimmed.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) results.push({ key, value: val });
  }
  return results;
}

export function EnvVarEditor({ value, onChange }: EnvVarEditorProps) {
  const baseId = useId();
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  function handleAdd() {
    onChange([...value, { key: "", value: "" }]);
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleChange(index: number, field: "key" | "value", val: string) {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: val };
    onChange(updated);
  }

  function toggleShow(id: string) {
    setShowValues((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>, index: number) {
    const text = e.clipboardData.getData("text");
    if (text.includes("=") && text.includes("\n")) {
      e.preventDefault();
      const parsed = parseEnvContent(text);
      if (parsed.length > 0) {
        const before = value.slice(0, index);
        const after = value.slice(index + 1);
        onChange([...before, ...parsed, ...after]);
      }
    }
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex gap-2 text-xs text-muted-foreground font-medium">
          <div className="flex-1">KEY</div>
          <div className="flex-1">VALUE</div>
          <div className="w-[72px]" />
        </div>
      )}
      {value.map((envVar, index) => {
        const id = `${baseId}-${index}`;
        return (
          <div key={id} className="flex gap-2 group">
            <Input
              value={envVar.key}
              onChange={(e) => handleChange(index, "key", e.target.value)}
              onPaste={(e) => handlePaste(e, index)}
              className="flex-1 font-mono text-sm"
            />
            <div className="relative flex-1">
              <Input
                type={showValues[id] ? "text" : "password"}
                value={envVar.value}
                onChange={(e) => handleChange(index, "value", e.target.value)}
                className="pr-10 font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9 opacity-50 hover:opacity-100"
                onClick={() => toggleShow(id)}
              >
                {showValues[id] ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="opacity-50 hover:opacity-100"
              onClick={() => handleRemove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
        <Plus className="mr-1 h-4 w-4" />
        Add Variable
      </Button>
    </div>
  );
}
