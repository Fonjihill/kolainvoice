import { useEffect, useRef, useState } from "react";

interface ComboboxItem {
  id: number;
  label: string;
  sublabel?: string;
}

function Combobox({
  items,
  value,
  onChange,
  onSearch,
  onCreate,
  placeholder,
  createLabel,
}: {
  items: ComboboxItem[];
  value: ComboboxItem | null;
  onChange: (item: ComboboxItem | null) => void;
  onSearch?: (query: string) => void;
  onCreate?: (name: string) => void;
  placeholder?: string;
  createLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleInputChange(val: string) {
    setQuery(val);
    onSearch?.(val);
    if (!open) setOpen(true);
  }

  function handleSelect(item: ComboboxItem) {
    onChange(item);
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    inputRef.current?.focus();
  }

  function handleCreate() {
    const trimmed = query.trim();
    if (!trimmed || !onCreate) return;
    onCreate(trimmed);
    setQuery("");
    setOpen(false);
  }

  const filtered = query.trim()
    ? items.filter(
        (i) =>
          i.label.toLowerCase().includes(query.toLowerCase()) ||
          i.sublabel?.toLowerCase().includes(query.toLowerCase()),
      )
    : items;

  const showCreate =
    onCreate &&
    query.trim() &&
    !filtered.some((i) => i.label.toLowerCase() === query.toLowerCase());

  return (
    <div ref={ref} className="relative">
      {value && !open ? (
        <div className="flex items-center justify-between text-sm px-3 py-2.5 border border-stone-300 bg-white">
          <div>
            <span className="text-stone-900 font-medium">{value.label}</span>
            {value.sublabel && (
              <span className="text-stone-400 ml-2 text-xs">
                {value.sublabel}
              </span>
            )}
          </div>
          <button
            onClick={handleClear}
            className="text-stone-400 hover:text-stone-600 text-xs ml-2"
          >
            Changer
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Rechercher..."}
          className="w-full text-sm px-3 py-2.5 border border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none transition-colors"
        />
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 shadow-lg z-40 max-h-[240px] overflow-y-auto">
          {filtered.length === 0 && !showCreate ? (
            <div className="px-4 py-3 text-sm text-stone-400">
              Aucun résultat
            </div>
          ) : (
            <>
              {filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0"
                >
                  <span className="text-stone-900 font-medium">
                    {item.label}
                  </span>
                  {item.sublabel && (
                    <span className="text-stone-400 ml-2 text-xs">
                      {item.sublabel}
                    </span>
                  )}
                </button>
              ))}
              {showCreate && (
                <button
                  onClick={handleCreate}
                  className="w-full text-left px-4 py-2.5 text-sm text-amber-600 font-medium hover:bg-amber-50 transition-colors border-t border-stone-100"
                >
                  + {createLabel ?? "Créer"} « {query.trim()} »
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Combobox;
