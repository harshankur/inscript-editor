import { ToolbarButton } from '../ToolbarButton.jsx';

/**
 * A row of buttons, one per choice, the current one shown as on (the selection menus' left /
 * centre / right groups).
 * @param {object} props
 * @param {Array<{ value: string, Icon: import('react').ComponentType<{ size?: number }>, title: string }>} props.options
 * @param {string|null|undefined} props.value - The current choice.
 * @param {(value: string) => void} props.onPick
 * @param {boolean} [props.disabled]
 */
export function ChoiceButtons({ options, value, onPick, disabled }) {
    return options.map(({ value: option, Icon, title }) => (
        <ToolbarButton key={option} onClick={() => onPick(option)} active={value === option} disabled={disabled} title={title}>
            <Icon size={15} />
        </ToolbarButton>
    ));
}
