export default function LoadingHub() {
  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-gray-200 rounded"></div>
          <div className="h-3.5 w-72 bg-gray-100 rounded"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-28 bg-gray-200 rounded"></div>
          <div className="h-8 w-28 bg-gray-200 rounded"></div>
        </div>
      </div>

      {/* Content table/card skeleton */}
      <div className="bg-white p-4 rounded-md border border-gray-200 space-y-3">
        <div className="h-4 w-40 bg-gray-200 rounded"></div>
        <div className="space-y-2 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded"></div>
                <div className="space-y-1.5">
                  <div className="h-3.5 w-32 bg-gray-200 rounded"></div>
                  <div className="h-3 w-20 bg-gray-200 rounded"></div>
                </div>
              </div>
              <div className="h-7 w-28 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
