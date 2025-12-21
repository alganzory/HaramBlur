// Language dictionary containing translations for English and Arabic
const getTranslations = (settings) => {
    return {
        en: {
            // English translations
            "#settings": "Settings",
            "#blurryStart": "Blur media on load:",
            ".tooltiptext":
                "When enabled, all images and videos will be blurred by default until detection starts.",
            "#blurAmount": `
			Blur Amount:
			<span id="blur-amount-value">${settings.blurAmount}%</span>
		`,
            "#grayscale": "Grayscale:",
            "#strictness": `Strictness:
		<span id="strictness-value">${settings.strictness * 100}%</span>
		`,
            "#mediaToBlur": "Media to Blur",
            "#blurImages": "Images",
            "#blurVideos": "Videos",
            "#facesToBlur": "Faces to Blur",
            "#blurMale": "Male",
            "#blurFemale": "Female",
            "#unblurOnHover": "Unblur on hover",
            "#unblurImages": "Images",
            "#unblurVideos": "Videos",
            ".refresh": " (requires page refresh):",
            "#refresh-message": "Refresh the page to see the changes.",
            ".bmc-btn-text": "Support the project",
            ".feedback": `
			<span> We love to hear your feedback through our </span> <a href="https://forms.gle/mDDjh44MKRVemWX86" target="_blank">Form</a> or 
			<a href="mailto:md.alganzory@gmail.com" target="_blank">Email</a> ❤️
			`,
            "#whitelist-desc": `
				<p id="whitelist-desc"> Detection is 
				<span id="whitelist-status-on" class="blue-text"> On </span> 
				<span id="whitelist-status-off" class="red-text hidden" > Off </span> 
				for this website </p>
			`,
        },
        ar: {
            // Arabic translations
            "#settings": "الإعدادات",
            "#blurryStart": "تشويش الوسائط مسبقا:",
            ".tooltiptext":
                "عند تفعيل هذا الخيار سيتم تشويش جميع الصور ومقاطع الفيديو مسبقا حتى يبدأ الكشف.",
            "#blurAmount": `
			كمية التشويش:
			<span id="blur-amount-value">${settings.blurAmount}%</span>
		`,
            "#grayscale": "رمادي:",
            "#strictness": `الدقة:
		<span id="strictness-value">${settings.strictness * 100}%</span>
		`,
            "#mediaToBlur": "الوسائط التي يجب تشويشها",
            "#blurImages": "الصور",
            "#blurVideos": "مقاطع الفيديو",
            "#facesToBlur": "الوجوه التي يجب تشويشها",
            "#blurMale": "الذكور",
            "#blurFemale": "الإناث",
            "#unblurOnHover": "إلغاء التشويش عند المرور بالمؤشر ",
            "#unblurImages": "الصور",
            "#unblurVideos": "مقاطع الفيديو",
            ".refresh": " (يتطلب إعادة تحميل الصفحة):",
            "#refresh-message": "أعد تحميل الصفحة لترى التغييرات.",
            ".bmc-btn-text": "دعم المشروع",
            ".feedback": `
			<span> نحب أن نسمع رأيك عبر </span> <a href="https://forms.gle/mDDjh44MKRVemWX86" target="_blank">الاستمارة</a> أو 
			<a href="mailto:md.alganzory@gmail.com" target="_blank">البريد الإلكتروني</a> ❤️
			`,
            "#whitelist-desc": `
				<p id="whitelist-desc"> الفحص 
				<span id="whitelist-status-on" class="blue-text"> مفعل </span> 
				<span id="whitelist-status-off" class="red-text hidden" > معطل </span> 
				لهذا الموقع </p>
			`,
        },
        // turkish
        tr: {
            "#settings": "Ayarlar",
            "#blurryStart": "Yüklenirken bulanıklaştır",
            ".tooltiptext":
                "Etkinleştirildiğinde, tüm resimler ve videolar, algılama başlayana kadar varsayılan olarak bulanıklaştırılır.",
            "#blurAmount": `
			Bulanıklaştırma seviyesi:
			<span id="blur-amount-value">${settings.blurAmount}%</span>
		`,
            "#grayscale": "Grileştir:",
            "#strictness": `Katılık:
		<span id="strictness-value">${settings.strictness * 100}%</span>
		`,
            "#mediaToBlur": "Bulanıklaştırılacak medya",
            "#blurImages": "Resimler",
            "#blurVideos": "Videolar",
            "#facesToBlur": "Bulanıklaştırılacak yüzler",
            "#blurMale": "Erkek",
            "#blurFemale": "Kadın",
            "#unblurOnHover": "Üzerine gelindiğinde bulanıklığı kaldır",
            "#unblurImages": "Resimler",
            "#unblurVideos": "Videolar",
            ".refresh": " (sayfa yenileme gerektirir):",
            "#refresh-message": "Değişiklikleri görmek için sayfayı yenile.",
            ".bmc-btn-text": "Projeyi destekle",
            ".feedback": `
			<span> Geri dönüşlerinizi </span> <a href="https://forms.gle/mDDjh44MKRVemWX86" target="_blank">Form</a> ve
			<a href="mailto:md.alganzory@gmail.com" target="_blank">E-mail</a> yoluyla bize bildirin.❤️
			`,
            "#whitelist-desc": `
				<p id="whitelist-desc"> Bu web sitesi için algılama
				<span id="whitelist-status-on" class="blue-text"> Açık </span> 
				<span id="whitelist-status-off" class="red-text hidden" > Kapalı </span> 
				</p>
			`,
        },
        //urdu
        ur: {
            "#settings": "ترتیبات",
            "#blurryStart": "لوڈ پر میڈیا کو دھندلا کرنا:",
            ".tooltiptext":
                "فعال ہونے پر، شناخت شروع ہونے تک تمام تصاویر اور ویڈیوز بطور ڈیفالٹ دھندلی ہو جائیں گی۔",
            "#blurAmount": `
			بلر کی مقدار:
			<span id="blur-amount-value">${settings.blurAmount}%</span>
		`,
            "#grayscale": "مٹیالا پیمانہ:",
            "#strictness": `سختی:
		<span id="strictness-value">${settings.strictness * 100}%</span>
		`,
            "#mediaToBlur": "میڈیا کو دھندلا کرنا",
            "#blurImages": "تصاویر",
            "#blurVideos": "ویڈیوز",
            "#facesToBlur": "چہرے کو دھندلا کرنا",
            "#blurMale": "مرد",
            "#blurFemale": "عورت",
            "#unblurOnHover": "ہوور پر دھندلا پن ختم کریں",
            "#unblurImages": "تصاویر",
            "#unblurVideos": "ویڈیوز",
            ".refresh": " (صفحہ ریفریش کی ضرورت ہے):",
            "#refresh-message": "تبدیلیاں دیکھنے کے لیے صفحہ کو ریفریش کریں۔",
            ".bmc-btn-text": "منصوبے کی حمایت کریں",
            ".feedback": `
			<span> میں اپنے فارم کے ذریعے آپ کی رائے سننا پسند ہے </span> <a href="https://forms.gle/mDDjh44MKRVemWX86" target="_blank"></a> ve
			<a href="mailto:md.alganzory@gmail.com" target="_blank">E-mail</a> ای میل.❤️
			`,
            "#whitelist-desc": `
				<p id="whitelist-desc"> کھوج ہے
				<span id="whitelist-status-on" class="blue-text"> جلنا </span> 
				<span id="whitelist-status-off" class="red-text hidden" > بند </span> 
				</p>
			`,
        },
        // german
        de: {
            "#settings": "Einstellungen",
            "#blurryStart": "Medien beim Laden verwischen:",
            ".tooltiptext":
                "Wenn diese Option aktiviert ist, werden alle Bilder und Videos standardmäßig verwischt, bis die Erkennung startet.",
            "#blurAmount": `
                Unschärfestärke:
            <span id="blur-amount-value">${settings.blurAmount}%</span>
        `,
            "#grayscale": "Graustufen:",
            "#strictness": `Strenge:
        <span id="strictness-value">${settings.strictness * 100}%</span>
        `,
            "#mediaToBlur": "Zu verwischende Medien",
            "#blurImages": "Bilder",
            "#blurVideos": "Videos",
            "#facesToBlur": "Zu verwischende Gesichter",
            "#blurMale": "Männlich",
            "#blurFemale": "Weiblich",
            "#unblurOnHover": "Beim Darüberfahren scharf anzeigen",
            "#unblurImages": "Bilder",
            "#unblurVideos": "Videos",
            ".refresh": " (Seitenaktualisierung erforderlich):",
            "#refresh-message": "Aktualisieren Sie die Seite, um die Änderungen zu sehen.",
            ".bmc-btn-text": "Projekt unterstützen",
            ".feedback": `
                <span> Wir freuen uns über Ihr Feedback über unser </span>
                <a href="https://forms.gle/mDDjh44MKRVemWX86" target="_blank">Formular</a> oder per
                <a href="mailto:md.alganzory@gmail.com" target="_blank">E-Mail</a> ❤️
            `,
            "#whitelist-desc": `
                <p id="whitelist-desc"> Erkennung ist
                <span id="whitelist-status-on" class="blue-text"> Aktiv </span>
                <span id="whitelist-status-off" class="red-text hidden"> Inaktiv </span>
                für diese Website </p>
            `,
        },
    };
};

const HB_TRANSLATIONS_DIR = {
    en: "ltr",
    tr: "ltr",
    ar: "rtl",
    ur: "rtl",
    de: "ltr",
};
