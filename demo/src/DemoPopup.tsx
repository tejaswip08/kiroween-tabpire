import { Popup } from '../../entrypoints/popup/Popup';
import '../../entrypoints/popup/popup.css';
/** The real toolbar popup, in a popup-sized frame in the middle of the demo page. */
export function DemoPopup() {
  return (
    <div className="demo-popup-stage">
      <div className="demo-popup-frame">
        <Popup />
      </div>
    </div>
  );
}
