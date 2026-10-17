import DioramaMap from "@/components/DioramaMap";
import IntroPanel from "@/components/IntroPanel";

export default function Home() {
  return (
    <main className="h-full">
      {/* Painted sky behind the 3D scene */}
      <div aria-hidden="true" className="fixed inset-0 z-0 bg-linear-to-b from-sky-top via-sky-mid via-40% to-sand-100">
        <div className="absolute top-[4%] left-[6%] size-[46vmin] rounded-full bg-[radial-gradient(circle,rgb(255_250_236/.9)_0_10%,rgb(255_236_214/.5)_32%,transparent_70%)]" />
      </div>
      <DioramaMap />
      <IntroPanel />
    </main>
  );
}
