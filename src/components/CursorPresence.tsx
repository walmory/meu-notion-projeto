import { motion } from 'framer-motion';

export interface CursorData {
  socketId: string;
  x: number;
  y: number;
  userName: string;
  color: string;
}

interface CursorPresenceProps {
  cursors: CursorData[];
}

export function CursorPresence({ cursors }: CursorPresenceProps) {
  return (
    <>
      {cursors.map((cursor) => (
        <motion.div
          key={cursor.socketId}
          initial={{ x: cursor.x, y: cursor.y, opacity: 0 }}
          animate={{ x: cursor.x, y: cursor.y, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            type: 'spring',
            damping: 30,
            mass: 0.8,
            stiffness: 350,
          }}
          className="pointer-events-none absolute left-0 top-0 z-50 flex flex-col"
          style={{
            transform: `translate(${cursor.x}px, ${cursor.y}px)`,
          }}
        >
          <div
            style={{
              width: '2px',
              height: '20px',
              backgroundColor: cursor.color,
            }}
          />
          <div
            className="absolute left-0 top-full mt-1 whitespace-nowrap rounded px-2 py-1 text-xs text-white"
            style={{ backgroundColor: cursor.color, width: 'fit-content' }}
          >
            {cursor.userName}
          </div>
        </motion.div>
      ))}
    </>
  );
}
