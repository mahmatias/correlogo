# Agent Instructions

- **Component Re-initialization**: Always use a `key` prop (e.g., plan ID) on components that rely on internal `useEffect` hooks for mounting/state-reset logic to ensure proper cleanup and re-initialization when switching between plan instances.
- **State Management**: Avoid direct or indirect `setState` calls that can trigger infinite renders during component mounting sequences.
- **Persistence**: Verify Firestore synchronization for user-specific data (theme, plans) by using explicit logs during development.
