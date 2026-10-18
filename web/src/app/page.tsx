import MapView from "@/components/MapView";

export default function Home() {
  return (
    <main className="h-full">
      <h1 className="sr-only">Gunk Radar — what Wisconsin&apos;s lakeshore factories release, and what it touches</h1>
      {/* Sky shows only when the map is tilted toward the horizon */}
      <div aria-hidden="true" className="fixed inset-0 z-0 bg-linear-to-b from-sky-top via-sky-mid via-40% to-sand-100" />
      <MapView />
    </main>
  );
}
