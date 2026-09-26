/**
 * Translations for the seeded guest reviews.
 *
 * Testimonials come from GET /api/testimonials/testimonials/ as free text a
 * customer typed, so there is no locale field to switch on. The keys below
 * are the exact English source strings created by
 * `manage.py seed_demo_content`, which is what lets us match a review to its
 * translation without a schema change.
 *
 * A review with no entry here still renders — it just shows the guest's
 * original English, which is the honest outcome rather than a blank card.
 * Adding a review to the seed command means adding its key here too.
 */
const translations = {
  "The fade was crisp, the shape suits me perfectly, and the whole visit felt calm and professional.":
    {
      am: "ፌዱ ጠርጭር ነበር፣ ቅርጽው በትክክል እኔን ይመስራል፣ እና ጉዞው ሙሉ በሙሉ ሰላምና ባለሙያነት ነበር።",
      om: "Fade n duraa, qoodaa kee guutummaan nama hin danda'u. Daawwata guutummaan nagaa eegamaa dhaabbate.",
    },

  "I came in with a picture and left with a cut that feels even better in person. Great attention to detail.":
    {
      am: "ፎቶ ይዞ ወጥቼ ገባለሁ፣ ግን በቀጥታ በተሻለ ቆርጠናለሁ። ዝርዝር ላይ ትኩረት አላላም።",
      om: "Suuraa fudhadhee dhuufnee gadhi, garuu gurgurta dhuguu guyyaa asirratti caala hedhaba. Qabiyyee bifa jijjiirraa waan eegame asitti olaanaa.",
    },

  "The texture advice was practical and easy to follow. My hair still looks good on day four.":
    {
      am: "ስህምቱ ስለምንርምርት የተሰጠው ምክር ተግባራዊና ቀላል ነው። በአራትኛው ቀን ገና የፀጉሬ ጥሩ ይመስላል።",
      om: "Gorsaa texture irratti yaadannoo qabiyyeffamaa qabeenyaa qabu, ilaalchuun salbataa. Gurgurtan koo guyyaa afurtamaa yoojiraan caala bifa olaanaa qaba.",
    },

  "Clean beard work, a comfortable chair, and no unnecessary fuss. I will be back next month.":
    {
      am: "ንጹህ የደረቅ ስራ፣ ሰላሙራዊ ወንበት እና ያልፈለገ ነገር የለም። ቀጣዩ ወር እችላለሁ።",
      om: "Gurgurta dhokaa qulqullaa, kursi mijataa, adeemtu biraa burtii hin qabu. Ji'aa dhangalaa deebi'a.",
    },

  "My curls finally have a shape that I can style at home. The finish is fresh but still natural.":
    {
      am: "እንድም አላጸድኩ የካርል ፖሮቼ በቤት እንደምገናኝ ቅርጽ አግኝተዋል። መጨረሻው አዲስ ነው፣ ግን የተፈጥሮ አቀርቦታም አላጠፋም።",
      om: "Koo formaa itti maruu danda'u koo gurgurtan erga dhume ni argame. Xumurama iskuulaa dhalaa yoo ta'e, kan dhabuu ta'e.",
    },

  "Quick, professional, and thoughtful. I walked in with a busy schedule and out on time looking sharp.":
    {
      am: "ፈጣን፣ ባለሙያነትና አስተዳዳሪ ነው። ብዙ ሥራ አለበኝ ገብቼ ወዲያውኑ በሰዓቱ ውጭ በጠርጭር ልባት ወጥቻለሁ።",
      om: "Asootaa, gargaa gochuu, yaadannoo qabu. Waliin seenyaa iskuulaan dhufee, yeroo dhugaa biraa daawwadhe, adeemtu caala bifa olaanaa.",
    },
};

/**
 * Quote text in the requested language, or null when we have no translation.
 *
 * Callers use the null to keep showing the guest's original English rather
 * than pretending a translation exists.
 */
export function getTranslatedQuote(message, locale) {
  if (!message || !locale || locale === "en") {
    return null;
  }

  // Whitespace-insensitive match: a stray newline in the seed data should not
  // silently drop a translation.
  const needle = String(message).replace(/\s+/g, " ").trim().toLowerCase();
  const entry = Object.entries(translations).find(
    ([english]) => english.replace(/\s+/g, " ").trim().toLowerCase() === needle
  );

  return entry?.[1]?.[locale] ?? null;
}

export const translatedTestimonials = translations;
