// Voice lines spoken via the browser's Hindi TTS voice (falls back to English-India).
// `hi` is spoken when a Hindi voice exists, `en` is the subtitle / fallback.
export const LINES = {
  crash: [
    { hi: 'अरे भाई भाई भाई!', en: 'Arre bhai bhai bhai!' },
    { hi: 'देख के चला ना!', en: 'Dekh ke chala na!' },
    { hi: 'गाड़ी का कचूमर बना दिया!', en: 'Gaadi ka kachumbar bana diya!' },
    { hi: 'ये क्या हो गया!', en: 'Ye kya ho gaya!' },
    { hi: 'लाइसेंस किसने दिया तुझे?', en: 'License kisne diya tujhe?' },
  ],
  hitPed: [
    { hi: 'ओए! अंधा है क्या?', en: 'Oye! Andha hai kya?' },
    { hi: 'भैया धीरे!', en: 'Bhaiya dheere!' },
    { hi: 'अरे मार डाला रे!', en: 'Arre maar daala re!' },
    { hi: 'धीरे चला यार!', en: 'Dheere chala yaar!' },
  ],
  hijack: [
    { hi: 'ओए मेरी गाड़ी!', en: 'Oye meri gaadi!' },
    { hi: 'चोर चोर! पकड़ो!', en: 'Chor chor! Pakdo!' },
    { hi: 'अभी तो EMI भी बाकी है!', en: 'Abhi toh EMI bhi baaki hai!' },
  ],
  wanted: [
    { hi: 'मामू आ गए, भागो!', en: 'Mamu aa gaye, bhaago!' },
    { hi: 'अब तो गए काम से!', en: 'Ab toh gaye kaam se!' },
    { hi: 'पुलिस! भाग मिल्खा भाग!', en: 'Police! Bhaag bhai bhaag!' },
  ],
  moreWanted: [
    { hi: 'और पुलिस आ गई!', en: 'Aur police aa gayi!' },
    { hi: 'ये तो बड़ा लफड़ा हो गया!', en: 'Ye toh bada lafda ho gaya!' },
  ],
  lostWanted: [
    { hi: 'बच गए भाई!', en: 'Bach gaye bhai!' },
    { hi: 'पुलिस को चकमा दे दिया!', en: 'Police ko chakma de diya!' },
  ],
  busted: [{ hi: 'पकड़े गए! चलो थाने!', en: 'Pakde gaye! Chalo thane!' }],
  dead: [{ hi: 'खतम, टाटा, बाय बाय!', en: 'Khatam, tata, bye bye!' }],
  missionDone: [
    { hi: 'शाबाश!', en: 'Shabash!' },
    { hi: 'क्या बात है! एकदम झकास!', en: 'Kya baat hai! Ekdum jhakaas!' },
    { hi: 'पैसा ही पैसा होगा!', en: 'Paisa hi paisa hoga!' },
    { hi: 'भाई तो भाई है!', en: 'Bhai toh bhai hai!' },
  ],
  missionFail: [
    { hi: 'कुछ नहीं हो सकता तेरा!', en: 'Kuch nahi ho sakta tera!' },
    { hi: 'फेल हो गए भाई!', en: 'Fail ho gaye bhai!' },
    { hi: 'मज़ाक चल रहा है क्या?', en: 'Mazaak chal raha hai kya?' },
  ],
  cow: [
    { hi: 'गाय को रास्ता दो भाई!', en: 'Gaay ko raasta do bhai!' },
    { hi: 'गाय माता से पंगा नहीं!', en: 'Gaay se panga nahi!' },
  ],
  blocked: [
    { hi: 'साइड दे ना भाई!', en: 'Side de na bhai!' },
    { hi: 'चल ना! बीच में क्यों खड़ा है?', en: 'Chal na! Beech mein kyun khada hai?' },
    { hi: 'हॉर्न ओके प्लीज़!', en: 'Horn OK please!' },
  ],
  pickup: [
    { hi: 'गरमा गरम समोसा!', en: 'Garma garam samosa!' },
  ],
  money: [
    { hi: 'पैसा ही पैसा!', en: 'Paisa hi paisa!' },
    { hi: 'आज तो लॉटरी लग गई!', en: 'Aaj toh lottery lag gayi!' },
  ],
  train: [{ hi: 'लोकल आ गई! पटरी से हटो!', en: 'Local aa gayi! Patri se hato!' }],
  welcome: [{ hi: 'स्वागत है मायानगरी में, भाई!', en: 'Swagat hai Mayanagri mein, bhai!' }],
  passenger: [
    { hi: 'भैया, स्टेशन चलोगे? मीटर से!', en: 'Bhaiya, station chaloge? Meter se!' },
    { hi: 'जल्दी चलो, लेट हो रहा है!', en: 'Jaldi chalo, late ho raha hai!' },
  ],
};

// Default soundboard (keys 1-9) when no custom clips are provided.
export const BOARD = [
  { key: '1', label: 'Arre bhai bhai bhai', line: { hi: 'अरे भाई भाई भाई!', en: 'Arre bhai bhai bhai!' } },
  { key: '2', label: 'Dramatic dhol', sfx: 'dramatic' },
  { key: '3', label: 'Truck horn tune', sfx: 'truck' },
  { key: '4', label: 'Jhakaas!', line: { hi: 'एकदम झकास!', en: 'Ekdum jhakaas!' } },
  { key: '5', label: 'Moo', sfx: 'moo' },
  { key: '6', label: 'Ye kya ho raha hai', line: { hi: 'ये क्या हो रहा है?', en: 'Ye kya ho raha hai?' } },
  { key: '7', label: 'Sad violin fail', sfx: 'fail' },
  { key: '8', label: 'Chai peelo', line: { hi: 'चाय पी लो, सब ठीक हो जाएगा!', en: 'Chai pee lo, sab theek ho jayega!' } },
  { key: '9', label: 'Bhai mat kar', line: { hi: 'भाई मत कर, भाई!', en: 'Bhai mat kar, bhai!' } },
];
