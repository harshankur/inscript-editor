import { Children, isValidElement } from 'react';

export const TOOLBAR_SIZES = {
    BUTTON: 38,
    DIVIDER: 12,
    CUSTOM: 48, // For selectors with text/extra icons
    GAP: 4
};

const ACTIVE_CLASSES = 'bg-[var(--inscript-color-active)] text-[var(--inscript-color-text)] shadow-inner';
const INACTIVE_CLASSES = 'text-[var(--inscript-color-muted)] hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)]';

/** Does the button show text of its own (not only an icon)? Then that text is its name. */
function showsText(children) {
    return Children.toArray(children).some(child => {
        if (typeof child === 'string' || typeof child === 'number') return String(child).trim() !== '';
        return isValidElement(child) && showsText(child.props.children);
    });
}

/**
 * A toolbar or menu button. An icon-only button is named for assistive technology by `title`; a
 * button showing text of its own is named by that text (its tooltip stays a description), unless
 * `ariaLabel` names it.
 *
 * `active` makes it a toggle: it reports `aria-pressed` with that state (bold on or off, the current
 * alignment). A button that shows or hides something (a popover) passes `expanded` instead: it
 * reports `aria-expanded`, not `aria-pressed`, since pressing it opens something rather than
 * switching something off; its `active` still draws it as set (a link or colour is applied).
 * `hasPopup` adds `aria-haspopup` for a button that opens a real dialog (one that takes focus).
 * `toggle={false}` keeps `active` as a highlight only, for a button that always does the same thing
 * (Math inserts another block even with the cursor in one).
 */
export const ToolbarButton = ({
    onClick, active, expanded, hasPopup, toggle = true, disabled, children, title, ariaLabel,
    className = "", width = TOOLBAR_SIZES.BUTTON, activeClassName = ACTIVE_CLASSES, inactiveClassName = INACTIVE_CLASSES,
}) => {
    const disclosure = expanded !== undefined;
    const pressed = disclosure || !toggle || active === undefined ? undefined : !!active;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={ariaLabel ?? (showsText(children) ? undefined : title)}
            aria-pressed={pressed}
            aria-expanded={disclosure ? !!expanded : undefined}
            aria-haspopup={hasPopup}
            style={{ width: `${width}px`, height: `${TOOLBAR_SIZES.BUTTON}px` }}
            className={`flex items-center justify-center rounded transition-colors shrink-0 ${active ? activeClassName : inactiveClassName
                } ${disabled ? 'opacity-20 cursor-not-allowed grayscale' : ''} ${className}`}
        >
            {children}
        </button>
    );
};
