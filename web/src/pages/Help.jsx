import { useState } from "react";
import {
  BadgePercent,
  CalendarCheck2,
  ChevronDown,
  CircleHelp,
  CreditCard,
  MessageCircle,
  Phone,
  Scissors,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import Button from "../components/Button";
import { listQuickAnswers } from "../services/quickAnswersApi";
import { EMPTY_LIST, useQuery } from "../hooks/useQuery";
import { toArray } from "../utils/toArray";

const faqs = [
  {
    question: "How does booking work?",
    answer: "Choose a service, barber, date and time, then send your booking. You will receive the appointment details to bring with you to the studio.",
  },
  {
    question: "Do I pay online or at the studio?",
    answer: "Follow the payment instructions shown after booking. If you need to pay or change a payment method at the studio, speak with the team before your service begins.",
  },
  {
    question: "Can my chosen service or price change when I arrive?",
    answer: "Yes, only when you ask for a different service or when your barber recommends extra work after seeing your hair in person. The team will explain the change and confirm any price difference with you before starting—never as a surprise.",
  },
  {
    question: "What if I need a different haircut after I arrive?",
    answer: "No problem. Show your barber a reference photo and describe the result you want. They will confirm the right service, timing and final price before the first cut.",
  },
  {
    question: "How do limited package discounts work?",
    answer: "Limited packages are subject to availability and can be confirmed when you book or call us. They cannot be combined with other offers and apply only to the named services in the package.",
  },
  {
    question: "Can I cancel or move an appointment?",
    answer: "Please contact the studio as early as you can. We will help you find the next available time and explain any payment adjustment if one is needed.",
  },
];

const steps = [
  { icon: CalendarCheck2, title: "Choose your time", text: "Pick a service, barber and appointment slot that fits your day." },
  { icon: CreditCard, title: "Confirm your booking", text: "Review the payment guidance and keep your booking details handy." },
  { icon: Scissors, title: "Meet your barber", text: "Arrive, talk through your look, then approve any changes before we begin." },
];

const packages = [
  { name: "Fresh Start", services: "Haircut + wash", offer: "10% off", accent: "For a clean reset" },
  { name: "Sharp Finish", services: "Haircut + beard shape", offer: "12% off", accent: "Our detail-focused pair" },
  { name: "The Full Ritual", services: "Haircut + wash + beard", offer: "15% off", accent: "Limited weekly slots" },
];

export default function Help() {
  const [openFaq, setOpenFaq] = useState(0);

  const { data: quickAnswerRows } = useQuery(
    "/quick-answers/",
    (signal) => listQuickAnswers({ signal }),
    { select: toArray }
  );
  const quickAnswers = quickAnswerRows || EMPTY_LIST;

  const faqList = [
    ...quickAnswers.map((row) => ({
      question: row.question,
      answer: row.answer,
    })),
    ...faqs,
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-[#090909] px-5 pb-24 pt-28 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1180px]">
        <section className="relative isolate rounded-2xl overflow-hidden border border-white/10 bg-[#111] px-6 py-14 sm:px-10 lg:px-16 lg:py-20">
          <div className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-[#d6a85f]/15 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 -z-10 h-36 w-2/3 bg-gradient-to-t from-[#d6a85f]/10 to-transparent" />
          <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[.9] tracking-tight sm:text-7xl">Everything you need<br /><span className="italic text-[#d6a85f]">before the chair.</span></h1>
          <p className="mt-7 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">Clear answers on services, payments, changes at the studio and getting the haircut you actually want.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button to="/booking">Book a service</Button>
            <a href="tel:+251911000000" className="inline-flex items-center gap-2 border border-white/15 px-5 py-3.5 text-sm font-semibold text-white/80 transition hover:border-[#d6a85f] hover:text-white"><Phone size={16} /> Call the studio</a>
          </div>
        </section>

        <section className="py-20">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl">From idea to <i>great haircut.</i></h2>
            </div>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, index) => <article key={title} className="relative rounded-2xl border border-white/10 bg-white/[.025] p-7">
            <span className="absolute right-6 top-5 font-serif text-5xl text-white/[.06]">0{index + 1}</span>
            <h3 className="mt-7 font-serif text-2xl">{title}</h3><p className="mt-3 text-sm leading-6 text-white/45">{text}</p></article>)}
          </div>
        </section>

        <section className="border-y border-white/10 py-20">
          <div className="flex items-start gap-4">
            <div>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl">More ritual. <i>Less spend.</i></h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/45">Ask us to confirm availability before your appointment. These offers are for a limited number of bookings and cannot be combined with another promotion.</p>
            </div>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {packages.map((pkg, index) => <article key={pkg.name} className={`relative overflow-hidden border p-7 ${index === 2 ? "border-[#d6a85f]/70 bg-[#d6a85f] text-black" : "border-white/10 bg-[#111]"}`}>
              <p className={`mt-5 text-xs font-semibold uppercase tracking-[.18em] ${index === 2 ? "text-black/65" : "text-white/35"}`}>{pkg.accent}</p>
              <h3 className="mt-2 font-serif text-3xl">{pkg.name}</h3>
              <p className={`mt-3 text-sm ${index === 2 ? "text-black/70" : "text-white/50"}`}>{pkg.services}</p>
            </article>)}
          </div>
        </section>

        <section className="grid gap-12 py-20 lg:grid-cols-[.85fr_1.15fr]">
          <div><p className="text-xs font-semibold uppercase tracking-[.28em] text-[#d6a85f]">Answers, clearly</p><h2 className="mt-4 font-serif text-4xl sm:text-5xl">No surprises<br /><i>at the mirror.</i></h2><div className="mt-8 flex gap-3 border-l-2 border-[#d6a85f] pl-4 text-sm leading-6 text-white/55"><ShieldCheck size={20} className="shrink-0 text-[#d6a85f]" />Any service or payment change is discussed with you before your barber starts.</div></div>
          <div className="divide-y divide-white/10 border-y border-white/10">{faqList.map((faq, index) => <div key={faq.question}><button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} className="flex w-full items-center justify-between gap-5 py-5 text-left text-base font-semibold text-white"><span>{faq.question}</span><ChevronDown size={19} className={`shrink-0 text-[#d6a85f] transition-transform ${openFaq === index ? "rotate-180" : ""}`} /></button>{openFaq === index && <p className="max-w-2xl pb-6 text-sm leading-7 text-white/50">{faq.answer}</p>}</div>)}</div>
        </section>

        <section className="mb-10 grid gap-6 border border-[#d6a85f]/35 bg-gradient-to-r from-[#1b1710] to-[#111] p-7 sm:p-10 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.28em] text-[#d6a85f]">Still need help?</p><h2 className="mt-3 font-serif text-3xl sm:text-4xl">Talk to a real person.</h2><p className="mt-3 text-sm leading-6 text-white/50">Need help choosing a service, changing a booking, or confirming a package? We are here.</p></div><div className="flex flex-wrap gap-3"><a href="tel:+251911000000" className="inline-flex items-center gap-2 bg-[#d6a85f] px-5 py-3 text-sm font-bold text-black transition hover:bg-[#e5bd7a]"><Phone size={16} /> Call us</a><a href="mailto:hello@noirbarbers.com" className="inline-flex items-center gap-2 border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-[#d6a85f]"><MessageCircle size={16} /> Email us</a></div></section>
      </div>
    </div>
  );
}
