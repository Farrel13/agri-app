export default function LoadingPetani() {
  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-6 w-56 bg-gray-200 rounded"></div>
        <div className="h-3.5 w-72 bg-gray-100 rounded"></div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-4 rounded-md border border-gray-200 space-y-2">
            <div className="h-3 w-28 bg-gray-200 rounded"></div>
            <div className="h-6 w-20 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>

      {/* Grid: Form & List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-md border border-gray-200 h-80 space-y-3">
          <div className="h-4 w-36 bg-gray-200 rounded"></div>
          <div className="h-9 bg-gray-100 rounded"></div>
          <div className="h-9 bg-gray-100 rounded"></div>
          <div className="h-9 bg-gray-100 rounded"></div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-md border border-gray-200 p-4 space-y-3">
              <div className="h-36 bg-gray-100 rounded"></div>
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
              <div className="h-3 w-24 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
