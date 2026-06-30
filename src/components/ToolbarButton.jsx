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
        className={`flex items-center justify-center rounded transition-colors shrink-0 ${active ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-inner' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
            } ${disabled ? 'opacity-20 cursor-not-allowed grayscale' : ''} ${className}`}
    >
        {children}
    </button>
);
