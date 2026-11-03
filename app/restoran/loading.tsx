export default function LoadingRestoran() {
  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-center pb-2">
        <div className="space-y-2">
          <div className="h-6 w-52 bg-gray-200 rounded"></div>
          <div className="h-3.5 w-72 bg-gray-100 rounded"></div>
        </div>
        <div className="h-8 w-44 bg-gray-200 rounded"></div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Products */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-10 bg-gray-200 rounded-md"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-md border border-gray-200 overflow-hidden">
                <div className="h-44 bg-gray-100"></div>
                <div className="p-4 space-y-2.5">
                  <div className="h-4 w-36 bg-gray-200 rounded"></div>
                  <div className="h-3 w-20 bg-gray-100 rounded"></div>
                  <div className="h-8 bg-gray-200 rounded mt-3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart sidebar */}
        <div className="bg-white rounded-md border border-gray-200 p-4 h-72 space-y-3">
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
          <div className="h-9 bg-gray-200 rounded mt-4"></div>
        </div>
      </div>
    </div>
  );
}
