// Offline answers of the WorkNest assistant (components/ChatBot). Every answer points to screens that exist in the
// customer app: the tabs Home, Bookings, Payments, Agreements and Profile, and on Home the quick actions
// (Book a space, Book a tour, Access request / Unlock door, Quotations) and Explore WorkNest (Gallery, About,
// Contact us). Keep them in step with navigation/AppNavigator.tsx and the User manual screen.

/** What the assistant knows from the API when it answers (each part may be missing: offline, still loading). */
export type BotContext = {
  /** WorkNest locations from GET /location/all (dbo.WN_Locations). */
  locations?: Array<{ name: string; address?: string | null }>;
};

type Rule = {
  keywords: string[];
  answer: string | ((context: BotContext) => string);
  /** Keywords must be whole words (short greetings such as "hi" would otherwise match "history"). */
  wholeWords?: boolean;
};

const CONTACT = "Home > Contact us";

// Specific questions first: "How do I cancel a booking?" must reach the cancel answer, not the booking steps.
export const CHAT_RULES: Rule[] = [
  {
    keywords: ["cancel", "refund"],
    answer: `Open the Bookings tab and tap Cancel on a booking that is still pending and not paid. For a paid booking or a refund, please contact us (${CONTACT}).`,
  },
  {
    keywords: ["history", "past booking", "my booking", "upcoming"],
    answer:
      "All your bookings and their challans are in the Bookings tab: Upcoming for current bookings, History for finished, cancelled and rejected ones.",
  },
  {
    keywords: ["quotation", "quote"],
    answer:
      "Quotations from our sales team are under Home > Quotations (also Profile > My quotations). Open one to accept or decline it.",
  },
  {
    keywords: ["agreement", "lease", "contract", "esign", "e-sign", "signature"],
    answer: "Agreements our team sends you are in the Agreements tab. Open one to read it and sign it in the app.",
  },
  {
    keywords: ["door", "unlock", "access"],
    answer:
      "To open your room door from the app, send an Access request from Home. Once it is approved, Home shows Unlock door instead.",
  },
  {
    keywords: ["payment", "pay", "challan", "price", "cost", "pkr", "fee", "rate"],
    answer: `Payment is by bank challan. After you confirm a booking, its challan appears in the Bookings and Payments tabs. Pay it at any HBL branch, ATM or in your mobile banking app under 1Bill / Bill Payment before the date on the challan. Your booking is confirmed once the payment reaches us.`,
  },
  {
    keywords: ["meeting", "conference", "boardroom"],
    answer:
      "Meeting rooms are booked by the hour. On Home, tap Book a space and choose Meeting room to see the rooms and their listed rate.",
  },
  {
    keywords: ["hour", "daily", "weekly", "monthly", "plan", "duration"],
    answer:
      "Meeting rooms are booked by the hour; private offices and shared desks by the month. Book a space on Home shows each space's listed rate, and the exact amount is on your challan.",
  },
  {
    keywords: ["office", "private", "dedicated"],
    answer:
      "Private offices are booked by the month. On Home, tap Book a space and choose Private office, or tap Book a tour to visit first.",
  },
  {
    keywords: ["hot desk", "hotdesk", "shared", "cowork", "co-work", "desk"],
    answer:
      "Shared desks are booked by the month. On Home, tap Book a space and choose Shared desk to see availability and the listed rate.",
  },
  {
    keywords: ["location", "city", "where", "address", "branch"],
    answer: locationsAnswer,
  },
  {
    keywords: ["wifi", "internet", "connection", "amenities", "facilities", "features", "include"],
    answer: `Amenities vary by space. Tap a space under Book a space on Home to see what it offers. For anything not listed, contact us (${CONTACT}).`,
  },
  {
    keywords: ["gallery", "photo", "image", "picture"],
    answer: "Browse photos of our spaces in the Gallery: Home > Explore WorkNest > Gallery.",
  },
  {
    keywords: ["tour", "visit"],
    answer: "Tap Book a tour on Home, choose a date and time, and our team will show you around.",
  },
  {
    keywords: ["book", "reserve"],
    answer:
      "To book a space:\n1. On Home, tap Book a space\n2. Search or filter by type and location, then tap a space\n3. Tap Book this space\n4. Pick the date and time (meeting rooms) or the start date and months (offices and desks)\n5. Check your details and tap Review booking\n6. Tap Confirm booking and get challan: you get a bank challan to pay",
  },
  {
    keywords: ["contact", "support", "help", "issue", "problem"],
    answer: `For support, open ${CONTACT} (also under Profile). Our team will get back to you as soon as possible.`,
  },
  {
    keywords: ["hello", "hi", "hey", "salam", "assalam"],
    wholeWords: true,
    answer: "Hello! I'm the WorkNest assistant. Ask me about booking, payments or spaces.",
  },
  {
    keywords: ["thank", "thanks", "great", "awesome"],
    answer: "You're welcome! Let me know if there's anything else I can help with.",
  },
];

export const CHAT_QUICK_QUESTIONS = [
  "How do I book a space?",
  "What payment methods are accepted?",
  "Do spaces have WiFi?",
  "Can I book by the hour?",
  "How do I cancel a booking?",
  "Where are your locations?",
];

export const CHAT_FALLBACK = `I'm not sure about that one. Try rephrasing, or contact our team (${CONTACT}) for detailed help.`;

/** The locations from the API by name (and address), or where to find them when the list is not available. */
function locationsAnswer(context: BotContext): string {
  const locations = (context.locations ?? []).filter((l) => l.name && l.name.trim());
  if (!locations.length) {
    return `Tap Book a tour on Home: its Location list shows every WorkNest location. For directions, contact us (${CONTACT}).`;
  }
  const lines = locations.map((l) => `- ${l.name.trim()}${l.address && l.address.trim() ? `: ${l.address.trim()}` : ""}`);
  const count = locations.length === 1 ? "one location" : `${locations.length} locations`;
  return `WorkNest has ${count}:\n${lines.join("\n")}\nTap Book a tour on Home to visit one, or Book a space to see its spaces.`;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matches(input: string, keyword: string, wholeWords: boolean): boolean {
  // Keywords match at the start of a word ("book" matches "booking", "hi" never matches "this").
  return new RegExp(`(^|[^a-z0-9])${escape(keyword)}${wholeWords ? "($|[^a-z0-9])" : ""}`).test(input);
}

/** A rule's answer as text (some answers use what the API sent, e.g. the locations). */
export function answerText(rule: Rule, context: BotContext = {}): string {
  return typeof rule.answer === "function" ? rule.answer(context) : rule.answer;
}

/** The assistant's answer to a question (first matching rule, else the fallback). */
export function getBotReply(input: string, context: BotContext = {}): string {
  const lower = input.toLowerCase();
  for (const rule of CHAT_RULES) {
    if (rule.keywords.some((kw) => matches(lower, kw, !!rule.wholeWords))) return answerText(rule, context);
  }
  return CHAT_FALLBACK;
}
