import { ActivePresenceUser } from '@/hooks/usePresence';

interface RemoteCursorProps {
  user: ActivePresenceUser;
}

export function RemoteCursor({ user }: RemoteCursorProps) {
  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: `${user.x}px`,
        top: `${user.y}px`,
      }}
    >
      <div
        className="w-[2px] h-6 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.35)]"
        style={{ backgroundColor: user.color }}
      />
      <div
        className="absolute left-0 -top-6 -translate-x-1/2 rounded-md border border-white/10 px-2 py-0.5 text-[11px] font-medium text-white shadow-xl"
        style={{
          backgroundColor: '#1a1a1a',
          boxShadow: `0 0 0 1px ${user.color}55`,
        }}
      >
        <span style={{ color: user.color }}>{user.userName}</span>
      </div>
    </div>
  );
}
