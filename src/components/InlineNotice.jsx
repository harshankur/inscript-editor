import { AlertCircle, Info, XCircle } from 'lucide-react';

const VARIANTS = {
    error: {
        icon: XCircle,
        wrapper: 'bg-red-500/10 border-red-500/20',
        icon_color: 'text-red-500',
        title: 'text-red-500',
        body: 'text-red-500/70',
    },
    warning: {
        icon: AlertCircle,
        wrapper: 'bg-amber-500/10 border-amber-500/20',
        icon_color: 'text-amber-500',
        title: 'text-amber-200',
        body: 'text-amber-200/70',
    },
    info: {
        icon: Info,
        wrapper: 'bg-blue-500/10 border-blue-500/20',
        icon_color: 'text-blue-500',
        title: 'text-blue-400',
        body: 'text-blue-400/70',
    },
};

/**
 * Shared feedback surface for library modals/panels. One visual pattern for
 * errors, warnings, and info so consumers never see silent failures.
 */
export const InlineNotice = ({ variant = 'info', title, children }) => {
    const style = VARIANTS[variant] || VARIANTS.info;
    const Icon = style.icon;
    return (
        <div className={`p-4 border rounded-xl flex gap-3 items-start ${style.wrapper}`} role={variant === 'error' ? 'alert' : 'status'}>
            <Icon className={`shrink-0 mt-0.5 ${style.icon_color}`} size={18} />
            <div>
                {title && <p className={`text-xs font-bold mb-1 ${style.title}`}>{title}</p>}
                {children && <p className={`text-[10px] leading-relaxed ${style.body}`}>{children}</p>}
            </div>
        </div>
    );
};
