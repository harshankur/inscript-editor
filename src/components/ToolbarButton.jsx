export const TOOLBAR_SIZES = {
    BUTTON: 38,
    DIVIDER: 12,
    CUSTOM: 48, // For selectors with text/extra icons
    GAP: 4
};

export const ToolbarButton = ({ onClick, active, disabled, children, title, className = "", width = TOOLBAR_SIZES.BUTTON }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        style={{ width: `${width}px`, height: `${TOOLBAR_SIZES.BUTTON}px` }}
        className={`flex items-center justify-center rounded transition-colors shrink-0 ${active ? 'bg-[var(--inscript-color-active)] text-[var(--inscript-color-text)] shadow-inner' : 'text-[var(--inscript-color-muted)] hover:bg-[var(--inscript-color-hover)] hover:text-[var(--inscript-color-text)]'
            } ${disabled ? 'opacity-20 cursor-not-allowed grayscale' : ''} ${className}`}
    >
        {children}
    </button>
);
