import { AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart } from 'lucide-react';
import { ChoiceButtons } from './ChoiceButtons.jsx';
import { PLACEMENT } from '../../constants.js';
import { layoutAlign } from '../../utils/layout.js';

/**
 * The left / centre / right placement buttons of the table, image and video menus. An object with
 * no placement of its own (or one the renderer does not know) sits in the centre, so that one shows
 * as current: the value is read as the renderer reads it (layoutAlign).
 * @param {object} props
 * @param {string|null|undefined} props.value - The object's placement.
 * @param {(align: string) => void} props.onPlace
 * @param {Record<string, string>} props.titles - The button names, by placement ('left', 'center', 'right').
 */
export function PlacementButtons({ value, onPlace, titles }) {
    return (
        <ChoiceButtons
            value={layoutAlign(value)}
            onPick={onPlace}
            options={[
                { value: PLACEMENT.LEFT, Icon: AlignHorizontalJustifyStart, title: titles[PLACEMENT.LEFT] },
                { value: PLACEMENT.CENTER, Icon: AlignHorizontalJustifyCenter, title: titles[PLACEMENT.CENTER] },
                { value: PLACEMENT.RIGHT, Icon: AlignHorizontalJustifyEnd, title: titles[PLACEMENT.RIGHT] },
            ]}
        />
    );
}
