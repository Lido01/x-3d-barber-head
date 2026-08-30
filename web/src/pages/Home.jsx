import { useState } from "react";
import Hero from "../sections/Hero";
import Testimonials from "../sections/Testimonials";
import Gallery from "../sections/Gallery";
import About from "../sections/About";
import { mediaUrl } from "../services/api";

export default function Home() {
  const [look, setLook] = useState(null);
  return (
    <>
      <Hero />
      <Gallery onSelect={setLook} />
      <Testimonials />
      <About />
      {look && <LookModal post={look} close={() => setLook(null)} />}
    </>
  );
}

function LookModal({ post, close }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onMouseDown={close}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-[#111]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <img
          src={mediaUrl(post.image)}
          alt={post.title}
          className="h-72 w-full object-cover"
        />
        <div className="p-7">
          <p className="text-[10px] uppercase tracking-[.25em] text-[#d6a85f]">
            {post.style_name || "Recent work"}
          </p>
          <h2 className="mt-3 font-serif text-4xl">{post.title}</h2>
          <p className="mt-4 text-sm leading-6 text-white/55">
            {post.description || "Fresh from the chair. Book this look and make it yours."}
          </p>
          <button
            onClick={close}
            className="mt-6 text-xs uppercase tracking-[.2em] text-[#d6a85f]"
          >
            Close details
          </button>
        </div>
      </div>
    </div>
  );
}
