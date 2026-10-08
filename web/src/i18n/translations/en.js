/**
 * English catalogue. This file is the shape every other language mirrors,
 * so keep the key tree in sync when you add a string.
 *
 * Scope is deliberately narrow: the public storefront (nav, hero, about,
 * quick book, gallery, testimonials, footer). Booking, payment and the staff
 * console stay in English — see docs/language-support.md.
 */
export default {
  common: {
    language: "Language",
    languageShort: "Language",
    beta: "Beta",
    changeLanguage: "Change language",
    loading: "Loading...",
    retry: "Try again",
    close: "Close",
  },

  nav: {
    home: "Home",
    services: "Services",
    haircuts: "Haircuts",
    barbers: "Barbers",
    gallery: "Gallery",
    about: "About",
    staff: "Staff",
    bookChair: "Book a Chair",
    menu: "More",
    closeMenu: "Close menu",
  },

  /**
   * The floating AI assistant.
   *
   * Translated because it is storefront chrome a customer chooses to open,
   * not part of the money-handling flow. The four suggestions are the
   * ones the assistant is actually good at answering from the catalogue,
   * so a customer who has not typed anything yet still gets four useful
   * prompts rather than an empty box.
   */
  ai: {
    title: "AI assistant",
    subtitle: "Services, prices and free times",
    open: "Open the AI assistant",
    minimize: "Minimise the assistant",
    close: "Close the assistant",
    clear: "Start a new chat",
    quickQuestions: "Show or hide quick questions",
    placeholder: "Ask about a cut, a price or a free time...",
    send: "Send",
    thinking: "Thinking...",
    emptyBody: "Ask me anything about our services, prices or free times.",
    errorBody:
      "The assistant cannot be reached just now. Please try again in a moment.",
    suggestions: {
      cuts: "Which haircut suits me?",
      price: "How much does a signature cut cost?",
      free: "When are you free today?",
      book: "I would like to book a fade",
    },
  },

  hero: {
    titleLead: "YOUR STYLE",
    titleTail: "YOUR IDENTITY",
    body: "A modern grooming studio built around precision, confidence, and the craft of the perfect cut.",
    primaryCta: "Book Your Chair",
    secondaryCta: "Explore Haircuts",
    openDaily: "Open daily 09:00 \u2014 21:00",
    city: "Addis Ababa",
  },

  about: {
    titleLead: "A chair made for your",
    titleAccent: "next chapter.",
    body: "NOIR is a modern grooming studio where classic barbering meets personal style. Every session starts with a conversation and finishes with a finish you can clearly see is yours.",
    cta: "Reserve your chair",
  },

  quickBook: {
    titleLead: "Choose. Book.",
    titleAccent: "Done in minutes.",
    body: "From picking a service to paying, the whole thing takes less time than a coffee. Here's how it works.",
    popularNow: "Popular right now",
    steps: {
      service: {
        title: "Pick your service",
        body: "Choose from fades, cuts, beard sculpts and more \u2014 each adds its own clear time and price.",
      },
      slot: {
        title: "Pick a time slot",
        body: "Live availability from the shop. You only see free slots for the day you want.",
      },
      pay: {
        title: "Pay in seconds",
        body: "Check out by Telebirr or bank transfer right away. No account, no waiting.",
      },
    },
  },

  gallery: {
    recentWork: "Recent work",
    titleLead: "The",
    titleAccent: "gallery.",
    body: "Real cuts from the chair \u2014 tap a look to explore the style and find the right booking time.",
    viewAll: "View full gallery",
    loading: "Loading the gallery...",
    errorTitle: "Could not load the gallery",
    emptyTitle: "Nothing here yet",
    emptyBody: "The shop hasn't shared any looks yet. Check back soon.",
  },

  look: {
    recentWork: "Recent work",
    body: "Fresh from the chair. Book this look and make it yours.",
    cta: "Book this look",
    close: "Close details",
  },

  footer: {
    tagline: "A modern Addis Ababa grooming studio where classic barbering meets personal style.",
    social: "Social",
    phone: "Phone",
    visit: "Visit",
  },

  account: {
    eyebrow: "Your account",
    title: "My account",
    lead: "Reviews you have written, and where each one is up to.",
    signedInAs: "Signed in as",
    myReviews: "My reviews",
    loadingReviews: "Loading your reviews...",
    reviewsErrorTitle: "Could not load your reviews",
    noReviewsTitle: "No reviews yet",
    noReviewsBody: "Once you write a review it will appear here with its status.",
    reviewPhotoAlt: "The cut you attached to your review",
    signInTitle: "Sign in",
    signInLead: "Sign in to leave a review on your visit.",
    signUpTitle: "Create an account",
    signUpLead: "An account lets you leave a review and check on it afterwards. Booking and paying never need one.",
    noAccount: "New to NOIR?",
    createOne: "Create an account",
    haveAccount: "Already have an account?",
    signInInstead: "Sign in",
    signOut: "Sign out",
    form: {
      username: "Username",
      email: "Email",
      firstName: "First name",
      lastName: "Last name",
      phone: "Phone (optional)",
      password: "Password",
      passwordConfirm: "Confirm password",
      passwordHint: "At least 8 characters, and not a word people guess.",
      submitSignIn: "Sign in",
      submitSignUp: "Create account",
      submitting: "Please wait...",
      errorTitle: "That did not work",
    },
  },

  testimonials: {
    titleLead: "Good looks,",
    titleAccent: "better stories.",    loading: "Loading reviews...",
    errorTitle: "Could not load reviews",
    emptyTitle: "No reviews yet",
    emptyBody: "Be the first to leave a note about your visit.",
    photoAlt: "{name}'s finished haircut",
    finishedAt: "Finished at NOIR",
    customerVisit: "Customer visit",
    noirGuest: "NOIR guest",
    originalText: "In English",
    translatedNote: "Translated from the guest's own words",
    rating: {
      one: "{count} star",
      many: "{count} stars",
    },
    form: {
      thanksTitle: "Thank you!",
      thanksBody: "Your review is with the shop and will appear here once it's approved.",
      writeAnother: "Write another",
      rateTitle: "Rate your visit.",
      messagePlaceholder: "What was your experience like?",
      addPhoto: "Add a photo of your cut (optional)",
      removePhoto: "Remove photo",
      previewAlt: "Your cut preview",
      errorTitle: "We couldn't save your review",
      submit: "Submit review",
      submitting: "Submitting...",
      approvalNote: "Reviews are shown only after the shop approves them.",
      messageRequired: "Please share your experience.",
      signInTitle: "Sign in to leave a review",
      signInBody: "Reviews come from a real customer, so we ask you to sign in or create an account first. It takes a moment, and you can check on your review afterwards.",
      signInCta: "Sign in",
      registerCta: "Create an account",
      postingAs: "Posting as {name}",
      postingAsNote: "This is the name that will appear on your review.",
      signInToPost: "Sign in to post",
    },
  },

  guests: {
    eyebrow: "The chair they sit in",
    titleLead: "Musicians, creators,",
    titleAccent: "and their honest words.",
    body: "Artists and creators pass through Bole all week. Here is what they say once they are out of the chair — no script, no approval, just the cut itself.",
    verified: "Verified visit",
    sampleNotice: "Sample content — guest personas are fictional.",
    viewGallery: "See the work",
    bookSameSlot: "Book a slot",
    statsLabel: "Studio at a glance",
    statVisits: "Visits since opening",
    statReturn: "Come back again",
    statRating: "Average rating",
    statWait: "Minutes of queue",
  },

  findUs: {
    eyebrow: "Find us",
    titleLead: "Bole Road,",
    titleAccent: "Addis Ababa.",
    body: "Second floor above the parade of shops on the main Bole road. The map below is centred on our door — the directions links will route you from wherever you are.",
    openDaily: "Open daily, 09:00 — 21:00",
    getDirections: "Get directions",
    openStreetMap: "View larger map",
    showOnMaps: "Open in Google Maps",
    copyAddress: "Copy address",
    copied: "Address copied",
    copyFailed: "Could not copy",
    approxNote: "Walking and driving times are approximate and change with traffic.",
    howToFind: "How to find the door",
    landmarkAirport: "Bole International Airport",
    landmarkMetro: "Bole Medhanealem metro station",
    landmarkParking: "Paid street parking on Bole Road",
    landmarkEntrance: "Stairwell beside the gold NOIR sign",
    minutesAway: "About {minutes} min",
    mode: {
      walking: "Walk",
      transit: "Transit",
      driving: "Drive",
    },
    mapTitle: "Map showing the location of NOIR Barbers on Bole Road",
    mapNote: "Map data (c) OpenStreetMap contributors",
  },
};
