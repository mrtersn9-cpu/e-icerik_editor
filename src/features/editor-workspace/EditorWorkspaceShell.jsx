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
        background: '#f3f7fc',
      }}
    >
      {children}
    </div>
  );
}
