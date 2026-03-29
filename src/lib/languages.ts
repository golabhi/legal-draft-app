export interface Language {
  code: string
  name: string       // native name
  label: string      // English label
  flag: string
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English',    label: 'English',   flag: '🇬🇧' },
  { code: 'gu', name: 'ગુજરાતી',    label: 'Gujarati',  flag: '🇮🇳' },
  { code: 'hi', name: 'हिंदी',       label: 'Hindi',     flag: '🇮🇳' },
  { code: 'mr', name: 'मराठी',       label: 'Marathi',   flag: '🇮🇳' },
  { code: 'ta', name: 'தமிழ்',       label: 'Tamil',     flag: '🇮🇳' },
  { code: 'te', name: 'తెలుగు',      label: 'Telugu',    flag: '🇮🇳' },
  { code: 'kn', name: 'ಕನ್ನಡ',       label: 'Kannada',   flag: '🇮🇳' },
  { code: 'ml', name: 'മലയാളം',      label: 'Malayalam', flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা',       label: 'Bengali',   flag: '🇮🇳' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ',      label: 'Punjabi',   flag: '🇮🇳' },
]

// Variable label translations: varName → { langCode: label }
export const LABEL_TRANSLATIONS: Record<string, Record<string, string>> = {
  // ── Petitioner / Applicant
  arjdar_name:       { en: 'Petitioner Name',             gu: 'અરજદારનું નામ',          hi: 'आवेदक का नाम',            mr: 'अर्जदाराचे नाव',         ta: 'மனுதாரர் பெயர்',         te: 'దరఖాస్తుదారు పేరు',      kn: 'ಅರ್ಜಿದಾರರ ಹೆಸರು',       ml: 'ഹർജിക്കാരന്റെ പേര്',     bn: 'আবেদনকারীর নাম',         pa: 'ਅਰਜ਼ੀਕਾਰ ਦਾ ਨਾਮ' },
  arjdar_pita_name:  { en: "Father / Husband Name",       gu: 'પિતા / પતિનું નામ',       hi: 'पिता / पति का नाम',       mr: 'वडील / पतीचे नाव',       ta: 'தந்தை / கணவர் பெயர்',    te: 'తండ్రి / భర్త పేరు',     kn: 'ತಂದೆ / ಗಂಡ ಹೆಸರು',       ml: 'പിതാവ് / ഭർത്താവ് പേര്', bn: 'পিতা / স্বামীর নাম',      pa: 'ਪਿਤਾ / ਪਤੀ ਦਾ ਨਾਮ' },
  arjdar_umer:       { en: 'Petitioner Age',               gu: 'અરજદારની ઉંમર',           hi: 'आवेदक की आयु',            mr: 'अर्जदाराचे वय',           ta: 'மனுதாரர் வயது',           te: 'దరఖాస్తుదారు వయస్సు',     kn: 'ಅರ್ಜಿದಾರರ ವಯಸ್ಸು',       ml: 'ഹർജിക്കാരന്റെ പ്രായം',   bn: 'আবেদনকারীর বয়স',         pa: 'ਅਰਜ਼ੀਕਾਰ ਦੀ ਉਮਰ' },
  arjdar_address:    { en: 'Petitioner Address',           gu: 'અરજદારનું સરનામું',       hi: 'आवेदक का पता',            mr: 'अर्जदाराचा पत्ता',        ta: 'மனுதாரர் முகவரி',         te: 'దరఖాస్తుదారు చిరునామా',   kn: 'ಅರ್ಜಿದಾರರ ವಿಳಾಸ',        ml: 'ഹർജിക്കാരന്റെ വിലാസം',   bn: 'আবেদনকারীর ঠিকানা',       pa: 'ਅਰਜ਼ੀਕਾਰ ਦਾ ਪਤਾ' },
  arjdar_shaher:     { en: 'Petitioner City',              gu: 'અરજદારનું શહેર',          hi: 'आवेदक का शहर',            mr: 'अर्जदाराचे शहर',          ta: 'மனுதாரர் நகரம்',          te: 'దరఖాస్తుదారు నగరం',       kn: 'ಅರ್ಜಿದಾರರ ನಗರ',          ml: 'ഹർജിക്കാരന്റെ നഗരം',     bn: 'আবেদনকারীর শহর',          pa: 'ਅਰਜ਼ੀਕਾਰ ਦਾ ਸ਼ਹਿਰ' },
  arjdar_pin:        { en: 'Petitioner PIN Code',          gu: 'અરજદારનો પિનકોડ',         hi: 'आवेदक का पिनकोड',         mr: 'अर्जदाराचा पिनकोड',       ta: 'மனுதாரர் பின்கோட்',       te: 'దరఖాస్తుదారు పిన్‌కోడ్',  kn: 'ಅರ್ಜಿದಾರರ ಪಿನ್‌ಕೋಡ್',   ml: 'ഹർജിക്കാരന്റെ പിൻകോഡ്',  bn: 'আবেদনকারীর পিন কোড',      pa: 'ਅਰਜ਼ੀਕਾਰ ਦਾ ਪਿਨਕੋਡ' },

  // ── Respondent / Opposite Party
  samnawala_name:      { en: 'Respondent / 2nd Applicant Name', gu: 'અરજદાર નં. ૨ નું નામ (સામેવાળા)',  hi: 'प्रतिवादी / द्वितीय आवेदक',  mr: 'प्रतिवादी / दुसऱ्या अर्जदाराचे नाव', ta: 'பதிலளிப்பவர் / 2வது மனுதாரர்', te: 'ప్రతివాది / 2వ దరఖాస్తుదారు', kn: 'ಪ್ರತಿವಾದಿ / 2ನೇ ಅರ್ಜಿದಾರ',  ml: 'പ്രതിവാദി / 2-ാം ഹർജിക്കാരൻ', bn: 'বিবাদী / ২য় আবেদনকারী',    pa: 'ਜਵਾਬਦੇਹ / ਦੂਜਾ ਅਰਜ਼ੀਕਾਰ' },
  samnawala_pita_name: { en: "Respondent's Father/Husband", gu: 'સામેવાળાના પિતા/પતિ',    hi: 'प्रतिवादी के पिता/पति',   mr: 'प्रतिवादीचे वडील/पती',    ta: 'பதிலளிப்பவர் தந்தை/கணவர்', te: 'ప్రతివాది తండ్రి/భర్త',   kn: 'ಪ್ರತಿವಾದಿ ತಂದೆ/ಗಂಡ',     ml: 'പ്രതിവാദി പിതാവ്/ഭർത്താവ്', bn: 'বিবাদীর পিতা/স্বামী',    pa: 'ਜਵਾਬਦੇਹ ਦੇ ਪਿਤਾ/ਪਤੀ' },
  samnawala_umer:      { en: 'Respondent Age',            gu: 'સામેવાળાની ઉંમર',          hi: 'प्रतिवादी की आयु',        mr: 'प्रतिवादीचे वय',          ta: 'பதிலளிப்பவர் வயது',        te: 'ప్రతివాది వయస్సు',         kn: 'ಪ್ರತಿವಾದಿ ವಯಸ್ಸು',        ml: 'പ്രതിവാദിയുടെ പ്രായം',    bn: 'বিবাদীর বয়স',              pa: 'ਜਵਾਬਦੇਹ ਦੀ ਉਮਰ' },
  samnawala_address:   { en: 'Respondent Address',        gu: 'સામેવાળાનું સરનામું',      hi: 'प्रतिवादी का पता',        mr: 'प्रतिवादीचा पत्ता',       ta: 'பதிலளிப்பவர் முகவரி',      te: 'ప్రతివాది చిరునామా',       kn: 'ಪ್ರತಿವಾದಿ ವಿಳಾಸ',         ml: 'പ്രതിവാദിയുടെ വിലാസം',    bn: 'বিবাদীর ঠিকানা',           pa: 'ਜਵਾਬਦੇਹ ਦਾ ਪਤਾ' },
  samnawala_shaher:    { en: 'Respondent City',           gu: 'સામેવાળાનું શહેર',          hi: 'प्रतिवादी का शहर',        mr: 'प्रतिवादीचे शहर',         ta: 'பதிலளிப்பவர் நகரம்',       te: 'ప్రతివాది నగరం',           kn: 'ಪ್ರತಿವಾದಿ ನಗರ',           ml: 'പ്രതിവാദിയുടെ നഗരം',      bn: 'বিবাদীর শহর',               pa: 'ਜਵਾਬਦੇਹ ਦਾ ਸ਼ਹਿਰ' },
  samnawala_pin:       { en: 'Respondent PIN Code',       gu: 'સામેવાળાનો પિનકોડ',        hi: 'प्रतिवादी का पिनकोड',     mr: 'प्रतिवादीचा पिनकोड',      ta: 'பதிலளிப்பவர் பின்கோட்',    te: 'ప్రతివాది పిన్‌కోడ్',      kn: 'ಪ್ರತಿವಾದಿ ಪಿನ್‌ಕೋಡ್',    ml: 'പ്രതിവാദി പിൻകോഡ്',       bn: 'বিবাদীর পিন কোড',           pa: 'ਜਵਾਬਦੇਹ ਦਾ ਪਿਨਕੋਡ' },

  // ── Marriage / Family
  lagna_tarikh:       { en: 'Marriage Date',              gu: 'લગ્ન તારીખ',               hi: 'विवाह तिथि',              mr: 'विवाह तारीख',              ta: 'திருமண தேதி',              te: 'వివాహ తేదీ',               kn: 'ವಿವಾಹ ದಿನಾಂಕ',            ml: 'വിവാഹ തീയതി',              bn: 'বিবাহের তারিখ',             pa: 'ਵਿਆਹ ਦੀ ਤਾਰੀਖ' },
  lagna_nondh_number: { en: 'Marriage Registration No.',  gu: 'લગ્ન નોંધ નંબર',           hi: 'विवाह पंजीकरण संख्या',    mr: 'विवाह नोंदणी क्रमांक',    ta: 'திருமண பதிவு எண்',         te: 'వివాహ నమోదు సంఖ్య',        kn: 'ವಿವಾಹ ನೋಂದಣಿ ಸಂಖ್ಯೆ',     ml: 'വിവാഹ രജിസ്ട്രേഷൻ നം.',   bn: 'বিবাহ নিবন্ধন নং.',         pa: 'ਵਿਆਹ ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਨੰ.' },
  lagna_sthal:        { en: 'Marriage Place',             gu: 'લગ્ન સ્થળ',                hi: 'विवाह स्थान',             mr: 'विवाह स्थळ',               ta: 'திருமண இடம்',              te: 'వివాహ స్థలం',              kn: 'ವಿವಾಹ ಸ್ಥಳ',              ml: 'വിവാഹ സ്ഥലം',              bn: 'বিবাহের স্থান',             pa: 'ਵਿਆਹ ਦੀ ਜਗ੍ਹਾ' },
  judai_tarikh:       { en: 'Separation Date',            gu: 'જુદા પડ્યાની તારીખ',       hi: 'अलगाव तिथि',              mr: 'विभक्त होण्याची तारीख',   ta: 'பிரிவு தேதி',               te: 'విడిపోయిన తేదీ',            kn: 'ಬೇರ್ಪಡಿಕೆ ದಿನಾಂಕ',        ml: 'വേർപിരിഞ്ഞ തീയതി',         bn: 'বিচ্ছেদের তারিখ',           pa: 'ਵੱਖ ਹੋਣ ਦੀ ਤਾਰੀਖ' },

  // ── Case / Court
  arji_tarikh:  { en: 'Filing Date',       gu: 'અરજી તારીખ',     hi: 'दाखिल तिथि',          mr: 'अर्ज तारीख',          ta: 'தாக்கல் தேதி',        te: 'దాఖలు తేదీ',          kn: 'ಸಲ್ಲಿಕೆ ದಿನಾಂಕ',     ml: 'ഫയലിംഗ് തീയതി',       bn: 'দাখিলের তারিখ',        pa: 'ਦਰਜ ਕਰਨ ਦੀ ਤਾਰੀਖ' },
  arji_sthal:   { en: 'Filing Place',      gu: 'અરજી સ્થળ',      hi: 'दाखिल स्थान',         mr: 'अर्ज स्थळ',           ta: 'தாக்கல் இடம்',         te: 'దాఖలు స్థలం',          kn: 'ಸಲ್ಲಿಕೆ ಸ್ಥಳ',        ml: 'ഫയലിംഗ് സ്ഥലം',        bn: 'দাখিলের স্থান',         pa: 'ਦਰਜ ਕਰਨ ਦੀ ਜਗ੍ਹਾ' },
  arji_number:  { en: 'Application No.',   gu: 'અરજી નંબર',      hi: 'आवेदन संख्या',        mr: 'अर्ज क्रमांक',        ta: 'விண்ணப்ப எண்',         te: 'దరఖాస్తు సంఖ్య',       kn: 'ಅರ್ಜಿ ಸಂಖ್ಯೆ',         ml: 'അപേക്ഷ നം.',           bn: 'আবেদন নং.',              pa: 'ਅਰਜ਼ੀ ਨੰ.' },
  court_shaher: { en: 'Court City',        gu: 'કોર્ટ શહેર',     hi: 'न्यायालय शहर',        mr: 'न्यायालय शहर',        ta: 'நீதிமன்ற நகரம்',       te: 'న్యాయస్థాన నగరం',      kn: 'ನ್ಯಾಯಾಲಯ ನಗರ',         ml: 'കോടതി നഗരം',           bn: 'আদালতের শহর',           pa: 'ਅਦਾਲਤ ਦਾ ਸ਼ਹਿਰ' },
  case_number:  { en: 'Case Number',       gu: 'કેસ નંબર',       hi: 'मुकदमा संख्या',       mr: 'केस क्रमांक',         ta: 'வழக்கு எண்',           te: 'కేసు సంఖ్య',           kn: 'ಪ್ರಕರಣ ಸಂಖ್ಯೆ',        ml: 'കേസ് നമ്പർ',           bn: 'মামলা নং.',              pa: 'ਕੇਸ ਨੰ.' },

  // ── General
  rakam:       { en: 'Amount (₹)',         gu: 'રકમ (₹)',        hi: 'राशि (₹)',            mr: 'रक्कम (₹)',           ta: 'தொகை (₹)',             te: 'మొత్తం (₹)',            kn: 'ಮೊತ್ತ (₹)',            ml: 'തുക (₹)',              bn: 'পরিমাণ (₹)',            pa: 'ਰਕਮ (₹)' },
  sal:         { en: 'Year',              gu: 'વર્ષ',           hi: 'वर्ष',               mr: 'वर्ष',               ta: 'ஆண்டு',               te: 'సంవత్సరం',             kn: 'ವರ್ಷ',                ml: 'വർഷം',                 bn: 'বছর',                   pa: 'ਸਾਲ' },
  client_name: { en: 'Client Name',       gu: 'ક્લાઇન્ટ નામ',  hi: 'ग्राहक का नाम',      mr: 'क्लायंट नाव',        ta: 'வாடிக்கையாளர் பெயர்', te: 'క్లయింట్ పేరు',        kn: 'ಗ್ರಾಹಕ ಹೆಸರು',        ml: 'ക്ലയന്റ് പേര്',       bn: 'ক্লায়েন্টের নাম',      pa: 'ਕਲਾਇੰਟ ਦਾ ਨਾਮ' },
  party_name:  { en: 'Party Name',        gu: 'પક્ષ નામ',       hi: 'पक्ष का नाम',        mr: 'पक्षाचे नाव',        ta: 'தரப்பு பெயர்',         te: 'పార్టీ పేరు',           kn: 'ಪಕ್ಷದ ಹೆಸರು',          ml: 'കക്ഷിയുടെ പേര്',      bn: 'পক্ষের নাম',             pa: 'ਧਿਰ ਦਾ ਨਾਮ' },
  lawyer_name: { en: 'Lawyer Name',       gu: 'વ્યારિસ્ટ નામ',  hi: 'वकील का नाम',        mr: 'वकिलाचे नाव',        ta: 'வழக்கறிஞர் பெயர்',    te: 'న్యాయవాది పేరు',        kn: 'ವಕೀಲರ ಹೆಸರು',         ml: 'അഭിഭാഷകന്റെ പേര്',    bn: 'আইনজীবীর নাম',          pa: 'ਵਕੀਲ ਦਾ ਨਾਮ' },
  date:        { en: 'Date',              gu: 'તારીખ',           hi: 'तारीख',              mr: 'तारीख',              ta: 'தேதி',                 te: 'తేదీ',                  kn: 'ದಿನಾಂಕ',               ml: 'തീയതി',                bn: 'তারিখ',                  pa: 'ਤਾਰੀਖ' },
  name:        { en: 'Name',              gu: 'નામ',             hi: 'नाम',                mr: 'नाव',                ta: 'பெயர்',                te: 'పేరు',                  kn: 'ಹೆಸರು',                ml: 'പേര്',                 bn: 'নাম',                    pa: 'ਨਾਮ' },
  address:     { en: 'Address',           gu: 'સરનામું',         hi: 'पता',                mr: 'पत्ता',              ta: 'முகவரி',               te: 'చిరునామా',              kn: 'ವಿಳಾಸ',                ml: 'വിലാസം',               bn: 'ঠিকানা',                 pa: 'ਪਤਾ' },
  phone:       { en: 'Phone Number',      gu: 'ફોન નંબર',        hi: 'फोन नंबर',           mr: 'फोन नंबर',           ta: 'தொலைபேசி எண்',        te: 'ఫోన్ నంబర్',           kn: 'ಫೋನ್ ಸಂಖ್ಯೆ',         ml: 'ഫോൺ നമ്പർ',            bn: 'ফোন নম্বর',              pa: 'ਫ਼ੋਨ ਨੰਬਰ' },
  description: { en: 'Description',      gu: 'વર્ણન',           hi: 'विवरण',              mr: 'वर्णन',              ta: 'விளக்கம்',             te: 'వివరణ',                 kn: 'ವಿವರಣೆ',               ml: 'വിവരണം',               bn: 'বিবরণ',                  pa: 'ਵੇਰਵਾ' },
  signature:   { en: 'Signature',         gu: 'સહી',             hi: 'हस्ताक्षर',          mr: 'स्वाक्षरी',           ta: 'கையொப்பம்',            te: 'సంతకం',                 kn: 'ಸಹಿ',                  ml: 'ഒപ്പ്',                bn: 'স্বাক্ষর',               pa: 'ਦਸਤਖਤ' },
  witness:     { en: 'Witness Name',      gu: 'સાક્ષીનું નામ',   hi: 'गवाह का नाम',        mr: 'साक्षीदाराचे नाव',    ta: 'சாட்சி பெயர்',         te: 'సాక్షి పేరు',           kn: 'ಸಾಕ್ಷಿ ಹೆಸರು',         ml: 'സാക്ഷിയുടെ പേര്',      bn: 'সাক্ষীর নাম',            pa: 'ਗਵਾਹ ਦਾ ਨਾਮ' },
}

/**
 * Get translated label for a variable in the given language.
 * Falls back to English, then auto-generates from variable name.
 */
export function getVarLabel(varName: string, langCode: string): string {
  const translations = LABEL_TRANSLATIONS[varName]
  if (translations) {
    return translations[langCode] || translations['en'] || autoLabel(varName)
  }
  return autoLabel(varName)
}

function autoLabel(varName: string): string {
  return varName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

export const LANG_STORAGE_KEY = 'legal_draft_language'
