import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Star } from "lucide-react";

// SVG component for the wave dividers
const WaveDivider: React.FC<{
  colorClassName: string;
  inverted?: boolean;
}> = ({ colorClassName, inverted = false }) => (
  <div
    className={`w-full h-20 md:h-32 ${colorClassName}`}
    style={{
      maskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%23ffffff' fill-opacity='1' d='M0,160L48,181.3C96,203,192,245,288,261.3C384,277,480,267,576,234.7C672,203,768,149,864,138.7C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E")`,
      maskSize: "cover",
      maskRepeat: "no-repeat",
      transform: inverted ? "scaleY(-1)" : "none",
    }}
  />
);

// Mock data for testimonials
const testimonials = [
  {
    id: 1,
    quote:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book.",
    name: "Name ABCD, ABCDE @ABCDE",
    colSpan: "md:col-span-2",
  },
  {
    id: 2,
    quote:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    name: "Name ABCD, ABCDE @ABCDE",
    colSpan: "md:col-span-1",
  },
  {
    id: 3,
    quote:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard",
    name: "Name ABCD, ABCDE @ABCDE",
    colSpan: "md:col-span-1",
  },
  {
    id: 4,
    quote:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    name: "Name ABCD, ABCDE @ABCDE",
    colSpan: "md:col-span-1",
  },
  {
    id: 5,
    quote:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    name: "Name ABCD, ABCDE @ABCDE",
    colSpan: "md:col-span-1",
  },
  {
    id: 6,
    quote:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    name: "Name ABCD, ABCDE @ABCDE",
    colSpan: "md:col-span-1",
  },
];

export default function HomePage() {
  return (
    <div className="text-white">
      {/* Hero Section */}
      <section className="bg-[#f5f5f3] text-black   relative overflow-hidden">
        <div className="max-w-screen-xl mx-auto px-6 grid md:grid-cols-[1fr_auto] gap-0 items-center relative">
          {/* Left Column */}
          <div className="flex flex-col z-10 max-w-2xl">
            <h1 
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-[#102E4A] leading-[0.95] tracking-tight"
              style={{ 
                fontFamily: "'New Rocker', cursive",
                letterSpacing: '-0.07em'
              }}
            >
              Where Web3 lives and builders connect
            </h1>
            <p 
              className="text-lg md:text-xl text-[#102E4A] mt-8 leading-relaxed font-bold"
              style={{ 
                fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                fontWeight: 700,
                letterSpacing: '-0.02em'
              }}
            >
              Decentralized Den is a luxury villa experience curated for the
              biggest Web3 events. Network. Unwind. Buidl IRL.
            </p>
            <Link
              href="/villas"
              className="bg-[#172a46] text-white text-base font-semibold py-4 px-10 rounded-full flex items-center justify-center space-x-3 mt-10 w-fit transition-all hover:scale-105 hover:shadow-2xl"
            >
              <span>Book your stay</span>
              <ArrowRight size={20} />
            </Link>
            {/* Stats */}
            <div className="flex flex-wrap gap-x-14 gap-y-6 mt-14">
              <div>
                <p className="font-display text-5xl font-bold text-[#172a46]">
                  500+
                </p>
                <p className="text-sm text-gray-600 mt-1.5">Community Members</p>
              </div>
              <div>
                <p className="font-display text-5xl font-bold text-[#172a46]">
                  340+
                </p>
                <p className="text-sm text-gray-600 mt-1.5">Guest Applied</p>
              </div>
              <div>
                <p className="font-display text-5xl font-bold text-[#172a46]">
                  75+
                </p>
                <p className="text-sm text-gray-600 mt-1.5">Guest Stayed</p>
              </div>
            </div>
            {/* Rating */}
            <div className="flex items-center space-x-3 mt-8">
              <div className="flex text-[#172a46]">
                <Star size={20} fill="currentColor" stroke="none" />
                <Star size={20} fill="currentColor" stroke="none" />
                <Star size={20} fill="currentColor" stroke="none" />
                <Star size={20} fill="currentColor" stroke="none" />
                <Star size={20} fill="currentColor" stroke="none" />
              </div>
              <span className="text-sm text-gray-700 font-semibold">
                4.7 Average user rating
              </span>
            </div>
          </div>
          {/* Right Column - Villa Image - MUCH LARGER */}
          <div className="relative w-[900px] h-[800px] -mr-32 md:block hidden">
            <Image
              src="/images/villas-bg-remove.png"
              alt="Luxury villa isometric view"
              fill
              className="object-contain scale-110"
              priority
              sizes="900px"
            />
          </div>
          {/* Mobile Villa Image */}
          <div className="md:hidden mt-12 flex justify-center">
            <div className="relative w-[500px] h-[450px]">
              <Image
                src="/images/villas-bg-remove.png"
                alt="Luxury villa isometric view"
                fill
                className="object-contain"
                priority
                sizes="500px"
              />
            </div>
          </div>
        </div>
        {/* Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <WaveDivider colorClassName="bg-[#172a46]" />
        </div>
      </section>

      {/* About Us Section */}
      <section className="bg-[#172a46] text-white py-28 relative">
        <div className="max-w-5xl mx-auto text-center px-6 z-10 relative">
          <h2 className="font-display text-5xl md:text-6xl font-bold mb-10">
            About Us
          </h2>
          <p className="text-base md:text-lg text-gray-300 leading-relaxed max-w-3xl mx-auto">
            DeDen is a decentralized villa experience built for the modern
            builder — where luxury meets community. Designed around the biggest
            Web3 events, DeDen transforms exclusive villas into living spaces
            for founders, creators, and dreamers to connect beyond panels and
            pitch decks.
          </p>
          <div className="mt-14 rounded-2xl overflow-hidden shadow-2xl">
            <Image
              src="/images/group.png"
              alt="DeDen Community Team"
              width={1000}
              height={500}
              className="w-full"
            />
          </div>
          <p className="text-base md:text-lg text-gray-300 leading-relaxed max-w-3xl mx-auto mt-14">
            Each Den is more than a stay — it's an ecosystem where collaboration
            happens over breakfast, ideas flow at midnight, and every
            conversation builds the next wave of innovation. From curated stays
            to immersive IRL networking, DeDen redefines what it means to build
            together.
          </p>
        </div>
      </section>

      {/* Upcoming Den Section */}
      <section className="bg-[#172a46] py-24">
        <div className="max-w-screen-xl mx-auto px-6">
          <div className="bg-[#f5f5f3] text-black rounded-[32px] p-12 md:p-16 grid md:grid-cols-2 gap-14 items-center shadow-2xl">
            {/* Left Column */}
            <div className="flex flex-col">
              <h3 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-[#172a46] leading-tight">
                The Next Den Awaits — Bangalore | Nov 29 – Dec 8
              </h3>
              <p className="text-lg md:text-xl text-gray-800 mt-8 font-bold leading-relaxed">
                Experience India Blockchain Week like never before.
              </p>
              <p className="text-base md:text-lg text-gray-700 mt-4 leading-relaxed">
                Stay where the most brilliant minds in Web3 gather, collaborate,
                and unwind.
              </p>
              <p className="text-base text-gray-600 mt-4 leading-relaxed">
                DeDen Bangalore is your home for IBW — a private villa designed
                for deep conversations, sleepless builds, and unforgettable
                after-hours. Join founders, investors, and creators who live
                where innovation never sleeps.
              </p>
              <Link
                href="/stay/bangalore-2025"
                className="bg-[#172a46] text-white text-base font-semibold py-4 px-9 rounded-full flex items-center justify-center space-x-3 mt-10 w-fit transition-all hover:scale-105 hover:shadow-2xl"
              >
                <span>Meet us at Bangalore</span>
                <ArrowRight size={20} />
              </Link>
            </div>
            {/* Right Column - Villa Image */}
            <div className="bg-gradient-to-br from-[#e0e0e0] to-[#c5c5c5] h-96 md:h-[450px] rounded-3xl flex items-center justify-center overflow-hidden shadow-inner relative">
              <div className="relative w-full h-full p-8">
                <Image
                  src="/images/villas-bg-remove.png"
                  alt="Bangalore Villa"
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-[#f5f5f3] text-black pt-10 pb-24 relative">
        {/* Top Wave (Inverted) */}
        <div className="absolute -top-20 md:-top-32 left-0 right-0">
          <WaveDivider colorClassName="bg-[#f5f5f3]" inverted />
        </div>
        <div className="max-w-screen-xl mx-auto px-6 relative z-10">
          <h2 className="font-display text-5xl md:text-6xl font-bold text-[#172a46] text-center mb-20">
            Testimonials
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((item) => (
              <div
                key={item.id}
                className={`bg-[#172a46] text-white p-8 md:p-10 rounded-3xl flex flex-col shadow-xl hover:shadow-2xl transition-shadow ${item.colSpan}`}
              >
                <p className="text-sm md:text-base text-gray-300 leading-relaxed flex-grow">
                  {item.quote}
                </p>
                <div className="flex items-center space-x-4 mt-8">
                  <div className="w-12 h-12 rounded-full bg-[#f5f5f3] flex items-center justify-center flex-shrink-0">
                    <span className="text-sm text-[#172a46] font-bold">
                      AB
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="bg-[#f5f5f3] text-black pb-24">
        <div className="max-w-screen-xl mx-auto px-6">
          <h2 className="font-display text-5xl md:text-6xl font-bold text-[#172a46] text-center mb-20">
            Gallery
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-3 gap-5">
            <div className="bg-[#172a46] h-56 md:h-96 rounded-3xl flex items-center justify-center text-white font-semibold text-xl col-span-1 shadow-lg hover:shadow-2xl transition-shadow">
              IMAGE
            </div>
            <div className="bg-[#172a46] h-56 md:h-96 rounded-3xl flex items-center justify-center text-white font-semibold text-xl col-span-1 shadow-lg hover:shadow-2xl transition-shadow">
              IMAGE
            </div>
            <div className="bg-[#172a46] h-56 md:h-96 rounded-3xl flex items-center justify-center text-white font-semibold text-xl col-span-1 shadow-lg hover:shadow-2xl transition-shadow">
              IMAGE
            </div>
            <div className="bg-[#172a46] h-56 md:h-96 rounded-3xl flex items-center justify-center text-white font-semibold text-xl col-span-2 shadow-lg hover:shadow-2xl transition-shadow">
              IMAGE
            </div>
            <div className="bg-[#172a46] h-56 md:h-96 rounded-3xl flex items-center justify-center text-white font-semibold text-xl col-span-1 shadow-lg hover:shadow-2xl transition-shadow">
              IMAGE
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-[#172a46] text-white pt-10 pb-12 relative">
        {/* Top Wave (Inverted) */}
        <div className="absolute -top-20 md:-top-32 left-0 right-0">
          <WaveDivider colorClassName="bg-[#172a46]" inverted />
        </div>
        <div className="max-w-screen-xl mx-auto px-6 z-10 relative">
          {/* Footer content */}
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-6">
                <Image
                  src="/images/logo-no-bg.png"
                  alt="DEDEN Logo"
                  width={140}
                  height={50}
                  className="h-12 w-auto"
                />
              </div>
              <p className="text-sm text-gray-400 mb-3">Get in touch</p>
              <p className="text-sm text-gray-200 mb-1">+91 55556 55556</p>
              <p className="text-sm text-gray-200">deden@gmail.com</p>
            </div>
            <div className="col-span-2 md:col-span-1">
              <h4 className="font-bold text-lg mb-5 text-white">Explore</h4>
              <ul className="space-y-3 text-sm text-gray-300">
                <li>
                  <Link href="/about" className="hover:text-white transition-colors">
                    About DeDen
                  </Link>
                </li>
                <li>
                  <Link href="/villas" className="hover:text-white transition-colors">
                    Upcoming Stays
                  </Link>
                </li>
                <li>
                  <Link
                    href="/collaborate"
                    className="hover:text-white transition-colors"
                  >
                    Collaborate with Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/experience"
                    className="hover:text-white transition-colors"
                  >
                    The Experience
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-white transition-colors">
                    Contact Us
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Sub-footer navigation bar */}
          <div className="bg-[#f5f5f3] text-black rounded-full py-5 px-10 md:px-14 max-w-2xl mx-auto flex justify-between items-center mb-14 shadow-lg">
            <Link
              href="/"
              className="font-bold text-[#172a46] hover:opacity-70 transition-opacity text-base"
            >
              Home
            </Link>
            <Link
              href="/villas"
              className="font-semibold text-gray-700 hover:text-[#172a46] transition-colors text-base"
            >
              Villas
            </Link>
            <Link
              href="/experiences"
              className="font-semibold text-gray-700 hover:text-[#172a46] transition-colors text-base"
            >
              Experiences
            </Link>
            <Link
              href="/careers"
              className="font-semibold text-gray-700 hover:text-[#172a46] transition-colors text-base"
            >
              Careers
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-center text-gray-400 text-sm">
            2025 DecentralizedDen. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}