export function EditorSkeleton() {
  return (
    <div className="flex-1 w-full h-full p-8 md:px-24 pt-24 animate-pulse bg-[#191919]">
      <div className="max-w-5xl mx-auto w-full">
        {/* Cover Skeleton */}
        <div className="w-full h-48 bg-[#1a1a1a] rounded-lg mb-8 opacity-50"></div>
        
        {/* Icon Skeleton */}
        <div className="w-16 h-16 bg-[#1a1a1a] rounded mb-6 opacity-50 -mt-16 relative z-10"></div>
        
        {/* Title Skeleton */}
        <div className="w-3/4 h-12 bg-[#1a1a1a] rounded mb-12 opacity-50"></div>
        
        {/* Content Lines */}
        <div className="space-y-4">
          <div className="w-full h-4 bg-[#1a1a1a] rounded opacity-50"></div>
          <div className="w-5/6 h-4 bg-[#1a1a1a] rounded opacity-50"></div>
          <div className="w-4/6 h-4 bg-[#1a1a1a] rounded opacity-50"></div>
          <div className="w-full h-4 bg-[#1a1a1a] rounded opacity-50 mt-8"></div>
          <div className="w-3/4 h-4 bg-[#1a1a1a] rounded opacity-50"></div>
        </div>
      </div>
    </div>
  );
}
