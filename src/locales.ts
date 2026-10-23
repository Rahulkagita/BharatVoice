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

export type LocaleKey =
  | 'tagline'
  | 'description'
  | 'languageLabel'
  | 'placeholder'
  | 'send'
  | 'micStart'
  | 'micStop'
  | 'stopSpeech'
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
  | 'welcome'
  | 'disclaimer';

type Locales = Record<LanguageCode, Record<LocaleKey, string>>;

export const LOCALES: Locales = {
  en: {
    tagline: 'Voice-first help for Indian government websites',
    description:
      'Ask in Telugu, Hindi, or English. Get help understanding forms, schemes, and eligibility — right on the page you are using.',
    languageLabel: 'Language',
    placeholder: 'Type your question…',
    send: 'Send',
    micStart: 'Start speaking',
    micStop: 'Stop listening',
    stopSpeech: 'Stop reading aloud',
    clearConversation: 'Clear conversation',
    listening: 'Listening…',
    processing: 'Working on your request…',
    speaking: 'Speaking…',
    errorNotSupported:
      'Speech recognition is not supported in this browser.',
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
    welcome:
      'Hello! I am BharatVoice, your multilingual assistant. Your message is sent to a secure backend assistant to generate a reply. Ask me a question, or tell me which form field you need help with.',
    disclaimer:
      'This is an AI-generated response. It is not verified government scheme information — please consult the relevant official government source before acting.',
  },
  hi: {
    tagline: 'भारतीय सरकारी वेबसाइटों के लिए वॉयस-आधारित सहायता',
    description:
      'तेलुगु, हिंदी या अंग्रेजी में प्रश्न पूछें। फॉर्म, योजनाओं और पात्रता को समझने में सहायता पाएं — उसी पेज पर जहां आप काम कर रहे हैं।',
    languageLabel: 'भाषा',
    placeholder: 'अपना प्रश्न टाइप करें…',
    send: 'भेजें',
    micStart: 'बोलना शुरू करें',
    micStop: 'सुनना बंद करें',
    stopSpeech: 'ज़ोर से पढ़ना रोकें',
    clearConversation: 'बातचीत साफ़ करें',
    listening: 'सुन रहा है…',
    processing: 'आपके अनुरोध पर काम कर रहा है…',
    speaking: 'बोल रहा है…',
    errorNotSupported: 'इस ब्राउज़र में भाषण पहचान समर्थित नहीं है।',
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
    welcome:
      'नमस्ते! मैं भारतवॉयस, आपका बहुभाषी सहायक हूँ। आपका संदेश एक सुरक्षित बैकएंड सहायक को भेजा जाता है जो उत्तर उत्पन्न करता है। मुझसे कोई प्रश्न पूछें, या बताएं कि किस फॉर्म फ़ील्ड में सहायता चाहिए।',
    disclaimer:
      'यह एक AI-जनित उत्तर है। यह सत्यापित सरकारी योजना की जानकारी नहीं है — कार्रवाई करने से पहले कृपया संबंधित आधिकारिक सरकारी स्रोत से परामर्श लें।',
  },
  te: {
    tagline: 'భారత ప్రభుత్వ వెబ్సైట్లకు గొంతు-మొదటి సహాయకుడు',
    description:
      'ప్రశ్నలు తెలుగులో, హిందీలో లేదా ఇంగ్లీష్ లో అడగండి. ఫారమ్‌లు, పథకం‌లు మరియు అర్హత గురించి మీరు ఉపయోగిస్తున్న పేజీపైనే సహాయం పొందండి.',
    languageLabel: 'భాష',
    placeholder: 'మీ ప్రశ్నను టైప్ చేయండి…',
    send: 'పంపండి',
    micStart: 'మాట్లాడటం ప్రారంభించండి',
    micStop: 'వింటున్నది ఆపేయండి',
    stopSpeech: 'మాట్లాడுவதను ఆపేయండి',
    clearConversation: 'సంభాషణను తొలగించండి',
    listening: 'వింటున్నాను…',
    processing: 'మీ అభ్యర్థనపై పనిచేస్తున్నాను…',
    speaking: 'మాట్లాడుతున్నాను…',
    errorNotSupported: 'ఈ బ్రౌజర్‌లో మాట గుర్తుద్దురికి మద్దతు లేదు.',
    errorUnknown: 'మైక్రోఫోన్‌ను యాక్సెస్ చేయలేదు.',
    errorMicDenied:
      'మైక్రోఫోన్ అనుమతి నిరాకరించబడింది. క్రోమ్ సెట్టింగ్స్‌లో భారతవాయిస్‌కు మైక్రోఫోన్ యాక్సెస్ అనుమతివ్వండి, మళ్ళి ప్రయత్నించండి. మీరు మీ ప్రశ్నను టైప్ చేయవచ్చు.',
    errorAudioCapture:
      'ఏదైనా మైక్రోఫోన్ దొరకలేదా లేదా ఇది మరో అప్‌లో ఉపయోగిస్తున్నది. విండోస్ శబ్ద సెట్టింగ్స్‌లో నిజమైన మైక్రోఫోన్ ఎంపిక చేయబడిందో ఉపయోగించండి (స్టీరియో మిక్స్ కాదు). మీరు మీ ప్రశ్నను టైప్ చేయవచ్చు.',
    errorServiceBlocked:
      'మాట గుర్తుద్దు సేవాకు అడ్డుపడింది. క్రోమ్ సైట్ మరియు ఎక్స్టెన్షన్ సెట్టింగ్స్ తనిఖీ చేయండి. మీరు మీ ప్రశ్నను టైప్ చేయవచ్చు.',
    errorNetwork:
      'మాట గుర్తుద్దు నెట్‌వర్క్ లోపం. మీ ఇంటర్నెట్ కనెక్షన్ తనిఖీ చేసి మళ్ళి ప్రయత్నించండి.',
    errorNoMatch:
      'ఏదైనా మాట గుర్తించబడలేదు. మైక్రోఫోన్‌లో స్పష్టంగా మాట్లాడి మళ్ళి ప్రయత్నించండి.',
    welcome:
      'నమస్తే! నేను భారతవాయిస్, మీ సహాయకుడు. మీ సందేశం సురక్షిత బ్యాకెడ్ సహాయకుడికి పంపబడింది, ఇది సమాధానాన్ని ఉత్పత్తి చేస్తుంది. నాకు ప్రశ్న అడగండి, లేదా ఏ ఫారమ్ ఫీల్డ్ లో సాయం కావాలి అనేది చెప్పండి.',
    disclaimer:
      'ఇది AI-సృష్టించిన సమాధానం. ఇది ధ్రువీకరించబడిన ప్రభుత్వ పథక సమాచారం కాదు — చర్య తీసుకునే ముందు సంబంధిత అధికారిక ప్రభుత్వ వనరులను సంప్రదించండి.',
  },
};