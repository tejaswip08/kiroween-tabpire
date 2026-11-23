/** Stands in for the toolbar popup until Spec 6 builds it. */
export function PopupPlaceholder() {
  return (
    <div
      style={{
        flex: '1 1 0',
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="demo-popup-frame"
        style={{
          width: 360,
          height: 520,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          border: '1px solid currentColor',
          borderRadius: 8,
        }}
      >
        <p>The popup is not built yet.</p>
      </div>
    </div>
  );
}
