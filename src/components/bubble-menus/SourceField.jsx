import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

/**
 * A compact, editable URL/source field for bubble menus — so the underlying source of a
 * node (a YouTube URL, an image `src`, an embed URL) is always visible AND replaceable
 * inline, instead of being hidden behind an opaque preview.
 *
 * Shows the current value, applies on Enter or blur (or the check button), reverts on
 * Escape. `validate(v)` (optional) blocks applying an invalid value without discarding
 * what the user typed.
 *
 * @param {object} props
 * @param {string}   props.value       Current value (controlled; resets the draft when it changes).
 * @param {(v:string)=>void} props.onApply  Called with the trimmed value when the user commits a change.
 * @param {(v:string)=>boolean} [props.validate]  Return false to block applying (keeps the draft).
 * @param {string} [props.placeholder]
 * @param {string} [props.label]       Accessible label / tooltip.
 * @param {React.ReactNode} [props.icon]
 * @param {string} [props.inputClassName]  Width/utility classes for the input (default `w-52`).
 */
export function SourceField({ value = '', onApply, validate, placeholder, label, icon, inputClassName = 'w-52' }) {
    const [draft, setDraft] = useState(value);
    const [dirty, setDirty] = useState(false);
    const [invalid, setInvalid] = useState(false);

    // Re-sync when a different node is selected or the attribute changes elsewhere.
    useEffect(() => { setDraft(value); setDirty(false); setInvalid(false); }, [value]);

    const apply = () => {
        const v = draft.trim();
        if (v === (value || '').trim()) { setDirty(false); setInvalid(false); return; }
        if (validate && !validate(v)) { setInvalid(true); return; }
        setInvalid(false);
        setDirty(false);
        onApply(v);
    };

    return (
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${invalid ? 'border-red-400 dark:border-red-500' : 'border-[var(--inscript-color-border)] focus-within:border-[var(--inscript-color-accent)]'} bg-[var(--inscript-color-surface)]`}>
            {icon && <span className="text-[var(--inscript-color-muted)] shrink-0 flex">{icon}</span>}
            <input
                type="text"
                value={draft}
                placeholder={placeholder}
                aria-label={label}
                title={label}
                spellCheck={false}
                autoComplete="off"
                className={`${inputClassName} min-w-0 bg-transparent text-xs text-[var(--inscript-color-text)] placeholder:text-[var(--inscript-color-muted)] outline-none`}
                onChange={(e) => { setDraft(e.target.value); setDirty(true); setInvalid(false); }}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); apply(); }
                    else if (e.key === 'Escape') { e.preventDefault(); setDraft(value); setDirty(false); setInvalid(false); e.currentTarget.blur(); }
                }}
                onBlur={apply}
            />
            {dirty && (
                <button
                    type="button"
                    // mousedown-preventDefault so the button click doesn't blur the input first
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={apply}
                    title={label}
                    className="shrink-0 flex items-center justify-center w-5 h-5 rounded text-[var(--inscript-color-accent)] hover:bg-[var(--inscript-color-accent-soft)]"
                >
                    <Check size={13} />
                </button>
            )}
        </div>
    );
}
