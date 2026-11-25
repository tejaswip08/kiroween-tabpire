// The words of the toolbar popup. Pure.
import { formatMb } from './hunger';

export const popupHeading = (starving: number): string => (starving > 0 ? `${starving} starving` : 'All fed');
export const popupSub = (vampires: number, mb: number): string => `${vampires} ${vampires === 1 ? 'vampire' : 'vampires'} \u00b7 ${formatMb(mb)} draining`;
/** The wide Dawn button: what it burns, or why it cannot. */
export const popupDawn = (n: number): string => (n > 0 ? `Dawn \u00b7 burn ${n}` : 'No one to burn');
