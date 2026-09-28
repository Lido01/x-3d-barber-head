import { useState } from "react";
import { Link } from "react-router-dom";

import Hero from "../sections/Hero";
import Marquee from "../sections/Marquee";
import Gallery from "../sections/Gallery";
import Testimonials from "../sections/Testimonials";
import About from "../sections/About";
import FindUs from "../sections/FindUs";

import { useLanguage } from "../i18n/LanguageContext";
import { mediaUrl } from "../services/api";

export default function Home() {
  const [look, setLook] = useState(null);

  return (
    <>
      <Hero />
      <Marquee />
      <Gallery onSelect={setLook} />
      <Testimonials />
      <About />
      <FindUs />
      {look && <LookModal post={look} close={() => setLook(null)} />}
    </>
  );
}

function LookModal({ post, close }) {
  const { t } = useLanguage();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onMouseDown={close}
    >
      <div
        className="w-full max-w-lg overflow-hidden  border border-white/15 bg-[#111]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <img
          src={mediaUrl(post.image)}
          alt={post.title}
          className="h-72 w-full object-cover"
        />
        <div className="p-7">
          <p className="text-[10px] uppercase tracking-[.25em] text-[#d6a85f]">
            {post.style_name || t("look.recentWork")}
          </p>
          <h2 className="mt-3 font-serif text-4xl">{post.title}</h2>
          <p className="mt-4 text-sm leading-6 text-white/55">
            {post.description || t("look.body")}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to={post.service ? `/booking?service=${post.service}` : "/booking"}
              className="flex-1  bg-[#d6a85f] px-6 py-3 text-center text-sm font-semibold text-black transition hover:bg-[#e5bd7a]"
            >
              {t("look.cta")}
            </Link>

            <button
              onClick={close}
              className="flex-1  border border-white/15 px-6 py-3 text-sm text-white/70 transition hover:bg-white/5"
            >
              {t("look.close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
