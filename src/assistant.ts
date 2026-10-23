import type { LanguageCode } from './types';
import { LOCALES } from './locales';

const SCHOLARSHIP_KEYWORDS = [
  // English
  'scholarship', 'scheme', 'eligible', 'eligibility', 'apply', 'application',
  // Hindi
  'छात्रवृत्ति', 'योजना', 'पात्र', 'पात्रता', 'आवेदन',
  // Telugu
  'స్కాల్‌షిప్', 'పథకం', 'పథకాలు', 'అర్హ', 'అర్హత', 'దరఖాస్తు',
];

const FIELD_KEYWORDS = [
  // English
  'field', 'form', 'fill', 'enter', 'what should i',
  // Hindi
  'फ़ील्ड', 'फॉर्म', 'भरें', 'क्या दर्ज',
  // Telugu
  'ఫీల్డ్', 'ఫారమ్', 'నమోదు', 'ఎందుకు',
];

function pick<T>(items: Record<LanguageCode, T>, lang: LanguageCode): T {
  return items[lang];
}

const GENERIC_BODY: Record<LanguageCode, string> = {
  en: 'I heard you: "{{text}}". This is a demonstration response from BharatVoice Stage 1. I cannot open government websites, verify eligibility, or fill forms yet — those capabilities are planned for later stages.',
  hi: 'मैंने आपका संदेश सुना: "{{text}}". यह भारतवॉयस चरण 1 का एक प्रदर्शन उत्तर है। मैं अभी सरकारी वेबसाइटें नहीं खोल सकता, पात्रता सत्यापित नहीं कर सकता और फॉर्म नहीं भर सकता — ये क्षमताएं आगे के चरणों में जोड़ी जाएंगी।',
  te: 'నేను మీ సందేశాన్ని విన్నాను: "{{text}}". ఇది భారతవాయిస్ దశ 1 యొక్క ప్రదర్శన సమాధానం. నేను ప్రభుత్వ వెబ్సైట్లను తెరవలేను, అర్హతను ధృవీకరించలేను మరియు ఫారమ్‌లను నింపలేను — ఈ ఫీచర్లు రాబోయే దశలలో ఉంటాయి.',
};

const SCHEME_BODY: Record<LanguageCode, string> = {
  en: 'You asked about scholarships or government schemes. In this demo I can only give a generic reply: please visit the official scheme portal, read the eligibility criteria carefully, and apply through the official application link.',
  hi: 'आपने छात्रवृत्ति या सरकारी योजनाओं के बारे में पूछा। इस प्रदर्शन में मैं केवल एक सामान्य उत्तर दे सकता हूँ: कृपया आधिकारिक योजना पोर्टल पर जाएं, पात्रता मानदंड ध्यान से पढ़ें और आधिकारिक आवेदन लिंक के माध्यम से आवेदन करें।',
  te: 'మీరు స్కాల్‌షిప్ లేదా ప్రభుత్వ పథకం గురించి అడిగారు. ఈ డెమోలో నేను సాధారణ సమాధానం మాత్రమే ఇస్తున్నాను: దయచేసి అధికారిక వెబ్సైట్‌ను సందర్శించండి, అర్హతను జాగ్రత్తగా చదవండి మరియు అధికారిక దరఖాస్తు లింక్ ద్వారా దరఖాస్తు చేయండి.',
};

const FIELD_BODY: Record<LanguageCode, string> = {
  en: 'You asked about a form field. In this demo I cannot see the page you are on, so I cannot identify the specific field. Please tell me the field label or describe it, and I will explain what information typically belongs there.',
  hi: 'आपने फॉर्म फ़ील्ड के बारे में पूछा। इस प्रदर्शन में मैं वह पेज नहीं देख सकता जिस पर आप हैं, इसलिए विशिष्ट फ़ील्ड की पहचान नहीं कर सकता। कृपया फ़ील्ड का लेबल बताएं या उसका वर्णन करें, मैं समझाऊंगा कि आमतौर पर वहां किस जानकारी की आवश्यकता होती है।',
  te: 'మీరు ఫారమ్ ఫీల్డ్ గురించి అడిగారు. ఈ డెమోలో నేను మీరు ఉన్న పేజీని చూడలేదు, కాబట్టి నిర్దిష్ట ఫీల్డ్‌ని గుర్తించలేదు. దయచేసి ఫీల్డ్ లేబెల్ చెప్పండి లేదా వివరించండి, నేను సాధారణంగా అక్కడ ఏ సమాచారం ఉండాలి అని వివరిస్తాను.',
};

export function getDemoResponse(userText: string, lang: LanguageCode): string {
  const trimmed = userText.trim();
  if (!trimmed) {
    return pick(
      {
        en: 'Please type or say something.',
        hi: 'कृपया कुछ टाइप करें या बोलें।',
        te: 'దయచేసి ఏదైనా టైప్ చేయండి లేదా మాట్లాడండి.',
      },
      lang
    );
  }

  const lower = trimmed.toLowerCase();
  let body: string;

  if (SCHOLARSHIP_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) {
    body = pick(SCHEME_BODY, lang);
  } else if (FIELD_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) {
    body = pick(FIELD_BODY, lang);
  } else {
    const template = pick(GENERIC_BODY, lang);
    body = template.replace('{{text}}', trimmed);
  }

  return `${body}\n\n${pick(LOCALES, lang).disclaimer}`;
}
