import type { Language, LanguageCode } from './types';

export type { LanguageCode };

export const LANGUAGES: Language[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    recognitionLang: 'en-IN',
    synthesisLang: 'en-IN',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    recognitionLang: 'hi-IN',
    synthesisLang: 'hi-IN',
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    recognitionLang: 'te-IN',
    synthesisLang: 'te-IN',
  },
];

/** BCP-47 tag for the HTML document language, shared with speech tags. */
export function documentLanguageFor(code: LanguageCode): string {
  return LANGUAGES.find((language) => language.code === code)?.recognitionLang ?? 'en-IN';
}

export type LocaleKey =
  | 'tagline'
  | 'description'
  | 'languageLabel'
  | 'placeholder'
  | 'send'
  | 'micStart'
  | 'micStop'
  | 'stopSpeech'
  | 'stopRequest'
  | 'clearConversation'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'errorMicDenied'
  | 'errorAudioCapture'
  | 'errorServiceBlocked'
  | 'errorNetwork'
  | 'errorNoMatch'
  | 'errorNotSupported'
  | 'errorUnknown'
  | 'errorVoiceMissing'
  | 'errorSynthesis'
  | 'errorSynthesisBlocked'
  | 'errorBackendNetwork'
  | 'errorBackendTimeout'
  | 'errorBackendBusy'
  | 'errorBackendUnavailable'
  | 'errorBackendValidation'
  | 'errorBackendUnknown'
  | 'errorDismiss'
  | 'voiceUnavailable'
  | 'preparingVoices'
  | 'emptyConversation'
  | 'welcome'
  | 'privacyNote'
  | 'disclaimer';

type Locales = Record<LanguageCode, Record<LocaleKey, string>>;

export const LOCALES: Locales = {
  en: {
    tagline: 'Voice-first help for Indian government websites',
    description:
      'Ask in Telugu, Hindi, or English. Get conversational help understanding forms, schemes, and eligibility. BharatVoice does not inspect or highlight content on the webpage you are viewing.',
    languageLabel: 'Language',
    placeholder: 'Type your question…',
    send: 'Send',
    micStart: 'Start speaking',
    micStop: 'Stop listening',
    stopSpeech: 'Stop reading aloud',
    stopRequest: 'Stop request',
    clearConversation: 'Clear conversation',
    listening: 'Listening…',
    processing: 'Working on your request…',
    speaking: 'Speaking…',
    errorNotSupported: 'Speech is not supported in this browser. You can still type.',
    errorUnknown: 'Could not access the microphone.',
    errorMicDenied:
      'Microphone permission was denied. Allow microphone access for BharatVoice in Chrome settings, then try again. You can still type your question.',
    errorAudioCapture:
      'No microphone was found or it is in use by another app. Check that a real microphone is selected (not "Stereo Mix") in Windows sound settings. You can still type your question.',
    errorServiceBlocked:
      'The speech recognition service is blocked. Check Chrome site and extension settings. You can still type your question.',
    errorNetwork:
      'Speech recognition network error. Check your internet connection and try again.',
    errorNoMatch:
      'No speech was recognized. Speak clearly into the microphone and try again.',
    errorVoiceMissing:
      'No {{language}} voice is installed for read-aloud. Install one in Windows/Chrome speech settings, or read the text reply. The assistant still works.',
    errorSynthesis: 'Could not read the reply aloud. You can still read the text reply.',
    errorSynthesisBlocked:
      'Chrome blocked speech playback. Check the extension and site sound settings, or read the text reply.',
    errorBackendNetwork:
      'Unable to reach the assistant backend. Check that it is running and that your internet connection works.',
    errorBackendTimeout:
      'The assistant took too long to respond. Please try again.',
    errorBackendBusy:
      'The assistant is busy right now. Please wait a moment and try again.',
    errorBackendUnavailable:
      'The assistant is temporarily unavailable. Please try again later.',
    errorBackendValidation:
      'The request could not be accepted. Check your message and try again.',
    errorBackendUnknown: 'The assistant could not respond. Please try again.',
    errorDismiss: 'Dismiss error',
    voiceUnavailable:
      'Voice recognition is not available in this browser. You can still type.',
    preparingVoices: 'Preparing voices…',
    emptyConversation: 'Start a conversation by typing or speaking above.',
    welcome:
      'Hello! I am BharatVoice, your multilingual assistant. Ask me a question, or tell me which form field you need help with.',
    privacyNote:
      'BharatVoice sends only the message you submit to its configured backend, which forwards it to Google Gemini to generate a reply. BharatVoice does not save accounts or conversation history. Do not share OTPs, passwords, Aadhaar numbers, or bank details.',
    disclaimer:
      'AI-generated responses can be wrong and are not verified government scheme information. Consult the relevant official government source before acting.',
  },
  hi: {
    tagline: 'भारतीय सरकारी वेबसाइटों के लिए वॉयस-आधारित सहायता',
    description:
      'तेलुगु, हिंदी या अंग्रेजी में प्रश्न पूछें। फॉर्म, योजनाओं और पात्रता को समझने में बातचीत के ज़रिए सहायता पाएं। भारतवॉयस अभी आपके द्वारा देखे जा रहे वेबपेज को नहीं पढ़ता और न ही उस पर कुछ हाइलाइट करता है।',
    languageLabel: 'भाषा',
    placeholder: 'अपना प्रश्न टाइप करें…',
    send: 'भेजें',
    micStart: 'बोलना शुरू करें',
    micStop: 'सुनना बंद करें',
    stopSpeech: 'ज़ोर से पढ़ना रोकें',
    stopRequest: 'अनुरोध रोकें',
    clearConversation: 'बातचीत साफ़ करें',
    listening: 'सुन रहा है…',
    processing: 'आपके अनुरोध पर काम कर रहा है…',
    speaking: 'बोल रहा है…',
    errorNotSupported: 'इस ब्राउज़र में भाषण समर्थित नहीं है। आप टाइप कर सकते हैं।',
    errorUnknown: 'माइक्रोफ़ोन तक पहुंच नहीं हो सकी।',
    errorMicDenied:
      'माइक्रोफ़ोन अनुमति अस्वीकार कर दी गई। क्रोम सेटिंग्स में भारतवॉयस के लिए माइक्रोफ़ोन एक्सेस अनुमति दें, फिर पुनः प्रयास करें। आप अपना प्रश्न टाइप कर सकते हैं।',
    errorAudioCapture:
      'कोई माइक्रोफ़ोन नहीं मिला या यह किसी अन्य ऐप्लिकेशन में उपयोग में है। विंडोज़ ध्वनि सेटिंग्स में कोई वास्तविक माइक्रोफ़ोन चुना है या नहीं जांचें (स्टीरियो मिक्स नहीं)। आप अपना प्रश्न टाइप कर सकते हैं।',
    errorServiceBlocked:
      'भाषण पहचान सेवा अवरुद्ध है। क्रोम साइट और एक्सटेंशन सेटिंग्स जांचें। आप अपना प्रश्न टाइप कर सकते हैं।',
    errorNetwork:
      'भाषण पहचान नेटवर्क त्रुटि। अपना इंटरनेट कनेक्शन जांचें और पुनः प्रयास करें।',
    errorNoMatch:
      'कोई भाषण पहचाना नहीं गया। माइक्रोफ़ोन में स्पष्ट बोलें और पुनः प्रयास करें।',
    errorVoiceMissing:
      'पढ़कर सुनाने के लिए {{language}} की आवाज़ स्थापित नहीं है। विंडोज़/क्रोम वाक् सेटिंग्स में एक आवाज़ स्थापित करें, या लिखित उत्तर पढ़ें। सहायक अभी भी काम करता है।',
    errorSynthesis: 'उत्तर को ज़ोर से नहीं पढ़ा जा सका। आप लिखित उत्तर पढ़ सकते हैं।',
    errorSynthesisBlocked:
      'क्रोम ने भाषण प्लेबैक रोक दिया। एक्सटेंशन और साइट की ध्वनि सेटिंग्स जांचें, या लिखित उत्तर पढ़ें।',
    errorBackendNetwork:
      'सहायक बैकएंड तक नहीं पहुंचा जा सका। जांचें कि वह चल रहा है और आपका इंटरनेट कनेक्शन ठीक है।',
    errorBackendTimeout:
      'सहायक को उत्तर देने में बहुत समय लगा। कृपया पुनः प्रयास करें।',
    errorBackendBusy:
      'सहायक अभी व्यस्त है। कृपया थोड़ी देर प्रतीक्षा करें और पुनः प्रयास करें।',
    errorBackendUnavailable:
      'सहायक अभी अस्थायी रूप से उपलब्ध नहीं है। कृपया बाद में पुनः प्रयास करें।',
    errorBackendValidation:
      'अनुरोध स्वीकार नहीं किया जा सका। अपना संदेश जांचें और पुनः प्रयास करें।',
    errorBackendUnknown: 'सहायक उत्तर नहीं दे सका। कृपया पुनः प्रयास करें।',
    errorDismiss: 'त्रुटि हटाएं',
    voiceUnavailable:
      'इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है। आप टाइप कर सकते हैं।',
    preparingVoices: 'आवाज़ें तैयार हो रही हैं…',
    emptyConversation: 'ऊपर टाइप करके या बोलकर बातचीत शुरू करें।',
    welcome:
      'नमस्ते! मैं भारतवॉयस, आपका बहुभाषी सहायक हूँ। मुझसे कोई प्रश्न पूछें, या बताएं कि किस फॉर्म फ़ील्ड में सहायता चाहिए।',
    privacyNote:
      'भारतवॉयस केवल आपके द्वारा भेजा गया संदेश अपने कॉन्फ़िगर किए गए बैकएंड को भेजता है, जो उत्तर बनाने के लिए उसे Google Gemini को अग्रेषित करता है। भारतवॉयस खाते या बातचीत इतिहास को सहेजता नहीं है। कृपया OTP, पासवर्ड, आधार संख्या या बैंक विवरण साझा न करें।',
    disclaimer:
      'AI से बने उत्तर गलत हो सकते हैं और सत्यापित सरकारी योजना जानकारी नहीं हैं। कार्रवाई करने से पहले संबंधित आधिकारिक सरकारी स्रोत से परामर्श लें।',
  },
  te: {
    tagline: 'భారత ప్రభుత్వ వెబ్‌సైట్ల కోసం వాయిస్-ఆధారిత సహాయం',
    description:
      'తెలుగు, హిందీ లేదా ఇంగ్లీష్‌లో ప్రశ్నలు అడగండి. ఫారమ్‌లు, పథకాలు మరియు అర్హతను అర్థం చేసుకోవడంలో సంభాషణ ద్వారా సహాయం పొందండి. భారతవాయిస్ ప్రస్తుతం మీరు చూస్తున్న వెబ్ పేజీని చదవదు మరియు పేజీలో ఏదీ హైలైట్ చేయదు.',
    languageLabel: 'భాష',
    placeholder: 'మీ ప్రశ్నను టైప్ చేయండి…',
    send: 'పంపండి',
    micStart: 'మాట్లాడటం ప్రారంభించండి',
    micStop: 'వినడం ఆపేయండి',
    stopSpeech: 'బిగ్గరగా చదవడం ఆపేయండి',
    stopRequest: 'అభ్యర్థన ఆపేయండి',
    clearConversation: 'సంభాషణను తొలగించండి',
    listening: 'వింటున్నాను…',
    processing: 'మీ అభ్యర్థనపై పనిచేస్తున్నాను…',
    speaking: 'మాట్లాడుతున్నాను…',
    errorNotSupported: 'ఈ బ్రౌజర్‌లో మాట గుర్తింపు సౌకర్యం లేదు. మీరు టైప్ చేయవచ్చు.',
    errorUnknown: 'మైక్రోఫోన్‌ను యాక్సెస్ చేయలేకపోయాం.',
    errorMicDenied:
      'మైక్రోఫోన్ అనుమతి నిరాకరించబడింది. క్రోమ్ సెట్టింగ్‌లలో భారతవాయిస్‌కు మైక్రోఫోన్ యాక్సెస్ అనుమతివ్వండి, ఆపై మళ్లీ ప్రయత్నించండి. మీరు మీ ప్రశ్నను టైప్ చేయవచ్చు.',
    errorAudioCapture:
      'మైక్రోఫోన్ దొరకలేదు లేదా అది మరో యాప్‌లో ఉపయోగంలో ఉంది. విండోస్ ధ్వని సెట్టింగ్‌లలో నిజమైన మైక్రోఫోన్ ఎంపిక చేయబడిందో చూడండి (స్టీరియో మిక్స్ కాదు). మీరు మీ ప్రశ్నను టైప్ చేయవచ్చు.',
    errorServiceBlocked:
      'మాట గుర్తింపు సేవకు అడ్డంకి ఉంది. క్రోమ్ సైట్ మరియు ఎక్స్‌టెన్షన్ సెట్టింగ్‌లను తనిఖీ చేయండి. మీరు మీ ప్రశ్నను టైప్ చేయవచ్చు.',
    errorNetwork:
      'మాట గుర్తింపు నెట్‌వర్క్ లోపం. మీ ఇంటర్నెట్ కనెక్షన్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.',
    errorNoMatch:
      'మాట గుర్తించబడలేదు. మైక్రోఫోన్‌లో స్పష్టంగా మాట్లాడి మళ్లీ ప్రయత్నించండి.',
    errorVoiceMissing:
      'బిగ్గరగా చదవడానికి {{language}} వాయిస్ ఇన్‌స్టాల్ చేయబడలేదు. Windows/Chrome స్పీచ్ సెట్టింగ్‌లలో ఒక వాయిస్‌ను ఇన్‌స్టాల్ చేయండి లేదా వచన సమాధానాన్ని చదవండి. సహాయకుడు ఇప్పటికీ పనిచేస్తాడు.',
    errorSynthesis: 'సమాధానాన్ని బిగ్గరగా చదవలేకపోయాం. మీరు వచన సమాధానాన్ని చదవవచ్చు.',
    errorSynthesisBlocked:
      'క్రోమ్ స్పీచ్ ప్లేబ్యాక్‌ను నిరోధించింది. ఎక్స్‌టెన్షన్ మరియు సైట్ ధ్వని సెట్టింగ్‌లను తనిఖీ చేయండి లేదా వచన సమాధానాన్ని చదవండి.',
    errorBackendNetwork:
      'సహాయకుడి బ్యాకెండ్‌ను చేరుకోలేకపోయాం. అది నడుస్తోందో మరియు మీ ఇంటర్నెట్ కనెక్షన్ సరిగ్గా ఉందో తనిఖీ చేయండి.',
    errorBackendTimeout:
      'సహాయకుడు సమాధానం ఇవ్వడానికి చాలా సమయం తీసుకున్నాడు. దయచేసి మళ్లీ ప్రయత్నించండి.',
    errorBackendBusy:
      'సహాయకుడు ప్రస్తుతం బిజీగా ఉన్నాడు. కొద్దిసేపు ఆగి మళ్లీ ప్రయత్నించండి.',
    errorBackendUnavailable:
      'సహాయకుడు ప్రస్తుతం తాత్కాలికంగా అందుబాటులో లేడు. తర్వాత మళ్లీ ప్రయత్నించండి.',
    errorBackendValidation:
      'అభ్యర్థనను స్వీకరించలేకపోయాం. మీ సందేశాన్ని తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.',
    errorBackendUnknown: 'సహాయకుడు సమాధానం ఇవ్వలేకపోయాడు. దయచేసి మళ్లీ ప్రయత్నించండి.',
    errorDismiss: 'లోపాన్ని తీసివేయండి',
    voiceUnavailable:
      'ఈ బ్రౌజర్‌లో వాయిస్ గుర్తింపు అందుబాటులో లేదు. మీరు టైప్ చేయవచ్చు.',
    preparingVoices: 'వాయిస్‌లు సిద్ధమవుతున్నాయి…',
    emptyConversation: 'పైన టైప్ చేయడం లేదా మాట్లాడడం ద్వారా సంభాషణ ప్రారంభించండి.',
    welcome:
      'నమస్తే! నేను భారతవాయిస్, మీ బహుభాషా సహాయకుడు. నాకు ప్రశ్న అడగండి లేదా ఏ ఫారమ్ ఫీల్డ్‌లో సహాయం కావాలో చెప్పండి.',
    privacyNote:
      'భారతవాయిస్ మీరు పంపిన సందేశాన్ని మాత్రమే తన బ్యాకెండ్‌కు పంపుతుంది; ఆ బ్యాకెండ్ సమాధానం తయారు చేయడానికి దానిని Google Geminiకి అందిస్తుంది. భారతవాయిస్ ఖాతాలు లేదా సంభాషణ చరిత్రను సేవ్ చేయదు. OTPలు, పాస్‌వర్డ్‌లు, ఆధార్ నంబర్లు లేదా బ్యాంక్ వివరాలను పంచుకోవద్దు.',
    disclaimer:
      'AI సృష్టించిన సమాధానాలు తప్పుగా ఉండవచ్చు మరియు ధృవీకరించబడిన ప్రభుత్వ పథక సమాచారం కావు. చర్య తీసుకునే ముందు సంబంధిత అధికారిక ప్రభుత్వ వనరును సంప్రదించండి.',
  },
};
