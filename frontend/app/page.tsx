"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Star } from "lucide-react";
import { VillaSlider } from "@/components/VillaSlider";
import { useEffect } from "react";

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
      "DeDen was the perfect mix of comfort and community. I met founders and creators I’d only seen online, and the conversations we had felt natural, inspiring, and genuinely impactful. It’s rare to find a space where you can unwind and still spark new ideas so effortlessly.",
    quoteBold:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, ",
    name: "Aditya Maurya,  @NoteAditya",
    colSpan: "md:col-span-5",
  },
  {
    id: 2,
    quote:
      "Staying at DeDen felt like joining a family of builders. From morning coffees to late-night brainstorms, every moment brought real connection and collaboration. I left with new friends, fresh ideas, and a renewed sense of energy for what I’m building.",
    quoteBold:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    name: "Satish,  @sta2234",
    colSpan: "md:col-span-4",
  },
  {
    id: 3,
    quote:
      "DeDen turned the event week into something unforgettable. The villa vibe, the late-night chats, the spontaneous collabs everything just clicked. It’s the first time an event stay actually helped me grow as a builder.",
    quoteBold:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    name: "Akshat, @nanogamer",
    colSpan: "md:col-span-3",
  },
  {
    id: 4,
    quote:
      "DeDen brought together some of the most genuine people I’ve met in Web3. The space made it easy to connect, share ideas, and feel inspired. It was the first event stay where I felt both productive and truly at home",
    quoteBold:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    name: "Rahul Bisht, @0xRahul23",
    colSpan: "md:col-span-3",
  },
  {
    id: 5,
    quote:
      "DeDen was the perfect place to connect and create. Great people, great energy, and conversations that actually mattered.",
    quoteBold:
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    name: "Priya Tripathi, @your_priya",
    colSpan: "md:col-span-3",
  },
];

export default function HomePage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="text-white">
      {/* Hero Section */}
      <section className="bg-transparent text-black   relative overflow-hidden z-10">
        <div className="max-w-screen-xl mx-auto px-6 grid md:flex gap-0 items-center relative">
          {/* Left Column */}
          <div className="flex flex-col z-10 w-full md:w-[60%]  md:mt-20">
            <h1
              className=" text-center md:text-start text-4xl md:text-8xl lg:text-8xl font-medium text-[#102E4A] leading-[0.95] tracking-tight"
              style={{
                fontFamily: "'New Rocker', cursive",
                letterSpacing: "-0.07em",
              }}
            >
              Where Web3 lives
            </h1>
            <h1
              className="text-center md:text-start text-3xl md:text-7xl lg:text-7xl font-medium text-[#102E4A] leading-[0.95] tracking-tight "
              style={{
                fontFamily: "'New Rocker', cursive",
                letterSpacing: "-0.07em",
              }}
            >
              and builders connect
            </h1>
            <div className="md:hidden mt-4 flex items-center w-full justify-center">
              <div className="relative w-[70%] max-w-[400px] h-[220px]">
                <Image
                  src="/images/villa-bg-remove.png"
                  alt="Luxury villa isometric view"
                  fill
                  className="object-contain scale-110"
                  priority
                  sizes="500px"
                />
              </div>
            </div>
            <p className="w-full text-center md:text-start   font-berlin text-md md:text-2xl text-[#102E4A] mt-4  font-bold md:w-[90%]">
              Decentralized Den is a luxury stay experience curated for the
              biggest Web3 events.
            </p>
            <p className="w-full text-center md:text-start  font-berlin  text-md md:text-2xl text-[#102E4A]  font-bold md:w-[90%]">
              Network. Unwind. Buidl IRL.
            </p>
            <div className="w-full items-center flex justify-center md:justify-start">
              <Link
                href="/villas"
                className=" bg-[#172a46] text-white text-md md:text-2xl font-semibold py-2 pl-6 md:pl-10 pr-2 rounded-full flex items-center justify-between space-x-3 mt-8 md:mt-10 w-fit transition-all hover:scale-105 hover:shadow-2xl gap-2 md:gap-4"
              >
                <span>Book your stay</span>
                <div className="bg-white px-2 py-2 md:px-3 md:py-3 rounded-full text-[#172a46]">
                  <ArrowRight className="w-3 h-3 md:w-5 md:h-5 " />
                </div>
              </Link>
            </div>

            {/* Stats */}
            <div className="hidden md:flex flex-wrap mt-8  md:mt-16 ">
              <div className="flex flex-col items-center border-r pr-4 border-b-2 pb-4">
                <p className="font-display text-6xl font-bold text-[#172a46]">
                  500+
                </p>
                <p className="text-md text-[#172a46] ">Community Members</p>
              </div>
              <div className="flex flex-col items-center border-x px-4 border-b-2 pb-4">
                <p className="font-display text-6xl font-bold text-[#172a46]">
                  340+
                </p>
                <p className="text-md text-[#172a46] ">Guest Applied</p>
              </div>
              <div className="flex flex-col items-center border-l pl-4 border-b-2 pb-4">
                <p className="font-display text-6xl font-bold text-[#172a46]">
                  75+
                </p>
                <p className="text-md text-[#172a46] ">Guest Stayed</p>
              </div>
            </div>
            {/* Rating */}
            <div className="hidden md:flex items-center space-x-3 mt-4">
              <div className="flex text-[#172a46]">
                <Star size={20} fill="currentColor" stroke="none" />
                <Star size={20} fill="currentColor" stroke="none" />
                <Star size={20} fill="currentColor" stroke="none" />
                <Star size={20} fill="currentColor" stroke="none" />
                <Star size={20} fill="currentColor" stroke="none" />
              </div>
              <span className="text-lg text-[#172a46] font-semibold">4.7</span>
              <span className="text-sm text-[#172a46] font-semibold -ml-2 ">
                Average user rating
              </span>
            </div>
          </div>
          {/* Right Column - Villa Image - MUCH LARGER */}
          <div className="relative w-[500px] h-[500px] -mr-32 md:block hidden z-20">
            <div className="absolute w-[620px] h-[553px]  -left-30 ">
              <Image
                src="/images/villa-bg-remove.png"
                alt="Luxury villa isometric view"
                fill
                className="object-contain scale-110"
                priority
                sizes="900px"
              />
            </div>
          </div>
          {/* Mobile Villa Image */}
        </div>
        {/* Bottom Wave */}
        <div className="relative w-screen h-[80vh] md:h-[90vh] -mt-60">
          <Image
            src="/images/deden-website-margin.png"
            alt="Bangalore Villa"
            fill
            className="object-cover object-center"
            priority
            sizes="100vw"
          />
        </div>
      </section>

      {/* About Us Section */}
      <section
        id="about"
        className="bg-[#172a46] text-white py-28 relative -mt-90 z-0 pt-60"
      >
        <div className="max-w-5xl mx-auto text-center px-6 z-10 relative">
          <h2 className="font-display text-3xl md:text-6xl font-bold mb-10">
            About Us
          </h2>
          <p className="text-left font-inter text-base text-md md:text-lg text-gray-300   mx-auto -tracking-wider">
            DeDen is a decentralized villa experience built for the modern
            builder, where luxury meets community. Designed around the biggest
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
          <p className="text-left font-inter text-base text-md md:text-lg text-gray-300   mx-auto mt-14 -tracking-wider">
            Each Den is more than a stay, it's an ecosystem where collaboration
            happens over breakfast, ideas flow at midnight, and every
            conversation builds the next wave of innovation. From curated stays
            to immersive IRL networking, DeDen redefines what it means to build
            together.
          </p>
        </div>
      </section>

      {/* Upcoming Den Section */}
      <section className="bg-[#172a46] py-24 ">
        <div className="max-w-screen-xl mx-auto px-6">
          <div className=" bg-[#E7E4DF] text-black rounded-4xl p-8 md:p-16 grid md:grid-cols-2 gap-14 items-center shadow-2xl">
            {/* Left Column */}
            <div className="flex flex-col order-2 md:order-1">
              <h3 className="font-display text-xl md:text-2xl lg:text-3xl font-bold text-[#172a46] leading-tight">
                The Next Den Awaits — IBW | <br />
                Nov 29 – Dec 10
              </h3>
              <p className="text-lg md:text-xl text-gray-800 mt-8 font-bold leading-relaxed">
                Experience India Blockchain Week like never before.
              </p>
              <p className="text-base md:text-lg text-gray-700 mt-4 leading-relaxed">
                Stay where the most brilliant minds in Web3 gather, collaborate,
                and unwind.
              </p>
              <p className="font-inter text-base text-gray-600 mt-4 -tracking-wider">
                DeDen Bangalore is your home for IBW, a private villa designed
                for deep conversations, sleepless builds, and unforgettable
                after-hours. Join founders, investors, and creators who live
                where innovation never sleeps.
              </p>
              <Link
                href="/stay/IBW-2025"
                className="bg-[#172a46] text-white text-base font-semibold py-4 px-9 rounded-full flex items-center justify-center space-x-3 mt-10 w-fit transition-all hover:scale-105 hover:shadow-2xl"
              >
                <span>Meet us at Bangalore</span>
                <ArrowRight size={20} />
              </Link>
            </div>
            <div className="order-1 md:order-2">
              <VillaSlider />
            </div>
            {/* Right Column - Villa Image */}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-[#E7E4DF] text-black pt-10 pb-24 relative">
        <div className="max-w-screen-xl mx-auto px-6 relative z-10">
          <h2 className=" text-[#172a46] text-center font-display text-3xl md:text-6xl font-bold mb-10">
            Testimonials
          </h2>

          {/* MOBILE/TABLET SLIDER */}
          <div className="md:hidden flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4">
            {testimonials.map((item) => (
              <div
                key={item.id}
                className="bg-[#172a46] min-w-[80%] snap-center text-white p-8 rounded-3xl flex flex-col shadow-xl"
              >
                <p className="font-inter text-sm text-gray-300 grow -tracking-wider">
                  "{item.quote}"
                </p>
                <div className="flex items-center space-x-4 mt-8">
                  <div className="w-12 h-12 rounded-full bg-[#f5f5f3] flex items-center justify-center">
                    <span className="text-sm text-[#172a46] font-bold">AB</span>
                  </div>
                  <p className="text-sm font-semibold">{item.name}</p>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP GRID ) */}
          <div className="hidden md:grid md:grid-cols-9 gap-6">
            {testimonials.map((item) => (
              <div
                key={item.id}
                className={`bg-[#172a46] text-white p-10 rounded-3xl flex flex-col shadow-xl ${item.colSpan} md:h-[350px]`}
              >
                <p className="font-inter text-lg text-gray-300 grow -tracking-wider">
                  "{item.quote}"
                </p>
                <div className="flex items-center space-x-4 mt-8">
                  <div className="w-12 h-12 rounded-full bg-[#f5f5f3] flex items-center justify-center">
                    <span className="text-sm text-[#172a46] font-bold">AB</span>
                  </div>
                  <p className="text-sm font-semibold">{item.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="bg-[#E7E4DF] text-black pb-24">
        <div className="max-w-screen-xl mx-auto px-6">
          <h2 className="font-display text-5xl md:text-6xl font-bold text-[#172a46] text-center mb-20">
            Gallery
          </h2>

          {/* 📱 MOBILE/TABLET SLIDER */}
          <div className="md:hidden flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="relative h-56 min-w-[80%] rounded-3xl overflow-hidden snap-center shadow-lg hover:shadow-2xl transition-transform hover:scale-[1.02]"
              >
                <Image
                  src={`/images/dedenbangalore${i}.jpeg`}
                  alt={`DeDen Bangalore Villa ${i}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>

          {/* 🖥 DESKTOP GRID */}
          <div className="hidden md:grid grid-cols-6 gap-5">
            {/* Image 1 */}
            <div className="relative h-56 md:h-96 col-span-2 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-transform hover:scale-[1.02]">
              <Image
                src="/images/dedenbangalore1.jpeg"
                alt="DeDen Bangalore Villa 1"
                fill
                className="object-cover"
              />
            </div>

            {/* Image 2 */}
            <div className="relative h-56 md:h-96 col-span-2 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-transform hover:scale-[1.02]">
              <Image
                src="/images/dedenbangalore2.jpeg"
                alt="DeDen Bangalore Villa 2"
                fill
                className="object-cover"
              />
            </div>

            {/* Image 3 */}
            <div className="relative h-56 md:h-96 col-span-2 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-transform hover:scale-[1.02]">
              <Image
                src="/images/dedenbangalore3.jpeg"
                alt="DeDen Bangalore Villa 3"
                fill
                className="object-cover"
              />
            </div>

            {/* Image 4 */}
            <div className="relative h-56 md:h-96 col-span-3 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-transform hover:scale-[1.02]">
              <Image
                src="/images/dedenbangalore4.jpeg"
                alt="DeDen Bangalore Villa 4"
                fill
                className="object-cover"
              />
            </div>

            {/* Image 5 */}
            <div className="relative h-56 md:h-96 col-span-3 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-transform hover:scale-[1.02]">
              <Image
                src="/images/dedenbangalore5.jpeg"
                alt="DeDen Bangalore Villa 5"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section */}
    </div>
  );
}
