export default function EditorWorkspaceShell({
  children,
  editorScrollRef,
}) {
  return (
    <div
      ref={editorScrollRef}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        background: 'linear-gradient(180deg,#dce8f4,#121b2a)',
      }}
    >
      {children}
    </div>
  );
}
