import liya from "../portraits/liya.svg";
import dawit from "../portraits/dawit.svg";
import tsion from "../portraits/tsion.svg";
import yonas from "../portraits/yonas.svg";
import saron from "../portraits/saron.svg";
import hiwot from "../portraits/hiwot.svg";

/**
 * Featured guest wall.
 *
 * ---------------------------------------------------------------------------
 * THESE ARE FICTIONAL PERSONAS. READ THIS BEFORE EDITING.
 * ---------------------------------------------------------------------------
 * Every name, handle and quote below is invented. The portraits are
 * illustrations drawn for this project — no real person is depicted, named or
 * quoted. They are NOT real endorsements.
 *
 * Putting invented words in the mouth of a real, identifiable person (an
 * Ethiopian artist, musician or creator) is defamation and a regulatory
 * problem for the shop, not a marketing shortcut. The same goes for lifting
 * someone's photo without a written release.
 *
 * To make these real, all three of these are required:
 *   1. the guest agrees to be listed, in writing;
 *   2. you have a photo you are licensed to publish (or shoot one in-house
 *      with consent);
 *   3. the quote is theirs, approved by them.
 *
 * Until then this section is presentation-ready sample content. Swap the
 * `portrait` value for a real published image URL and update the copy; the
 * component does not care where the image comes from.
 *
 * Quotes are authored per locale rather than machine-translated at runtime —
 * see docs/language-support.md.
 */
export const featuredGuests = [
  {
    id: "liya-t",
    name: "Liya T.",
    handle: "@liya.afterdark",
    field: "Afrobeats artist",
    portrait: liya,
    accent: "#e08a8a",
    rating: 5,
    visit: "Records, Addis",
    quote: {
      en: "Between shows I come here and nobody recognises me. That is the whole point — I leave looking like me, not a version of somebody else.",
      am: "በኮምሰርት መካከል ወደህኝ እቅራለሁ፣ ማንም አያውቀውም። ይህስ ሁሉ ነው። ምንም ልህ ሳይመለስ እንደ እኔ አለሁ እንደ ሌላ ሰው ተመሳሳይ አይደለም።",
      om: "Shaqee keessatti ofi gara dhuufnee. Namni tokko hin argu. Kanneen guutummaa. Yoo koo yoo ta'e, nama biraa qofti dhalaa ta'aachuun deebi'a.",
    },
  },
  {
    id: "dawit-k",
    name: "Dawit K.",
    handle: "@dawitcuts",
    field: "Creator, 1.2M",
    portrait: dawit,
    accent: "#6fc7d4",
    rating: 5,
    visit: "Content house, Bole",
    quote: {
      en: "My videos are shot in daylight, so a cut that photographs badly is a problem. This is the only chair in Addis I trust with it.",
      am: "ቪዲዮዎቼ በቀኑ ብርሃን ይነዳሉ፣ ስለዚህ በሳይጠር የሚታይ ቆርጠና ችግር ነው። በአዲስ አበባ የምታመነው ብቻ ወንበት ነው።",
      om: "Viidiyoo koo guyyaa ibsaa qofa qoftaaf dhufu. Gurgurta yoo hin qophu humna qaba. Kursi tokko Adaabaabaa ati ilaalamuu danda'u.",
    },
  },
  {
    id: "tsion-a",
    name: "Tsion A.",
    handle: "@tsion.sings",
    field: "Singer",
    portrait: tsion,
    accent: "#a08ad6",
    rating: 5,
    visit: "Studio hours, Piazza",
    quote: {
      en: "I was growing out a bad cut from somewhere else. Abebe reshaped it and talked me through the whole thing. My hair finally behaves.",
      am: "ከሌላ ቦታ የተሳሳተ መቁረጥ እየጨመር ነበር። አበቤ በድጋሚ በደረሰ መሳልና ሙሉ በሙሉ አስታየኝ። ፀጉሬ አሁን ላይ እየሆነ ነው።",
      om: "Gurgurta badaa idilee erga gurgurten ture. Abebe qabiyyee guutummaa uumamee qabiyyee koo hundaa gaafate. Gurgurtan koo yeroobaa qophaa'aa ta'a.",
    },
  },
  {
    id: "yonas-b",
    name: "Yonas B.",
    handle: "@yonas.bites",
    field: "Food & city creator",
    portrait: yonas,
    accent: "#e0b45f",
    rating: 5,
    visit: "Filming location, Bole",
    quote: {
      en: "Six shoots a week and I cannot afford a bad haircut. The fade holds for weeks — I film on day nine and it still looks sharp.",
      am: "በሳምትን ስድስት ቅደም ተከታታይ አደርጋለሁ፣ ብቻ የተሳሳተ ቆርጠና ልስል አይችልኝም። ፌዱ ሳምንታዎች ይቀጥላል — በዘጠኝኛው ቀን ስታንቀሳቅስ ግን ጠርጭር ነው።",
      om: "Kiree saphso tokkichaatti argaa, gurgurta badaa kaffaluu hin dandeessu. Fade guyyaawwan afurtamaa itti fufa — guyyaa sagarsaa dhummatti yoo fudhate bifa nagaa dha.",
    },
  },
  {
    id: "saron-m",
    name: "Saron M.",
    handle: "@saronframes",
    field: "Music video director",
    portrait: saron,
    accent: "#6fc79a",
    rating: 5,
    visit: "By appointment",
    quote: {
      en: "I judge a cut the way I judge a shot. Composition, edges, weight. Nothing here is accidental and the result holds up in 4K.",
      am: "ቆርጠናን እንደ ምስል አመለክታለሁ። ስብሰብ፣ ጠርጅቶች፣ ክብደት። እዚህ ምንም ነገር በነጣጥ አይደለም፣ ውጤቱ በ4K ውስጥ እይታለ።",
      om: "Gurgurta akkuma tasgabbii ilaalamaa dha. Harii, dheeraa, dheekamaa. Kanneen waan tokko yoo ta'e hin argu, natiijoo 4K keessatti dhaabbata.",
    },
  },
  {
    id: "hiwot-g",
    name: "Hiwot G.",
    handle: "@hiwot.daily",
    field: "Lifestyle creator",
    portrait: hiwot,
    accent: "#e07fb0",
    rating: 5,
    visit: "Walk-in, Saturday",
    quote: {
      en: "I booked a cut and stayed three hours talking. That is the thing people miss — this is a studio, not a queue.",
      am: "ቆርጠና ተያዝቼ ሦስት ሰዓት ቆይቼ ወጥላለሁ። ሰዎች የሚያመለክቱበት ነገር ይህ ነው — እዚህ ወረፋ አይደለም፣ ስቱዲዮ ነው።",
      om: "Gurgurta qabsi turtii daqiiqaa sadii turtan ture. Namni adeemtu hin ollatan kan jedhame kana: kunun dhugaa miti, kutaa studioo miti.",
    },
  },
];

/** Stat strip shown under the wall. */
export const guestStats = [
  { id: "visits", value: "12k+", labelKey: "guests.statVisits" },
  { id: "regulars", value: "94%", labelKey: "guests.statReturn" },
  { id: "rating", value: "4.9", labelKey: "guests.statRating" },
  { id: "wait", value: "0", labelKey: "guests.statWait" },
];
