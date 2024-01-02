// Use event delegation to handle changes in the select element (language selecting dropdown at header)
document.getElementById('language').addEventListener('change', function() {
	changeLanguage(this.value);
  });

// Language dictionary containing translations for English and Arabic
const language = {
	en: {
		// English translations
		title: "HaramBlur Extension",
		settings: "Settings",
		blurryStart: "Blur media on load:",
		toolTipText: "When enabled, all images and videos will be blurred by default until detection starts.",
		blurAmount: "Blur amount:",
		grayscale: "Grayscale:",
		strictness: "Strictness:",
		mediaToBlur: "Media to Blur (requires page refresh):",
		blurImages: "Images",
		blurVideos: "Videos",
		facesToBlur: "Faces to Blur (requires page refresh):",
		blurMale: "Male",
		blurFemale: "Female",
		unblurOnHover: "Unblur on hover (requires page refresh):",
		unblurImages: "Images",
		unblurVideos: "Videos"
	},
	ar: {
		// Arabic translations
		title: "تمديد هارام بلر",
		settings: "الإعدادات",
		blurryStart: "تشويش الوسائط عند التحميل:",
		toolTipText: "will edit this later",
		blurAmount: "كمية التشويش:",
		grayscale: "درجة الرمادي:",
		strictness: "التشدد:",
		mediaToBlur: "الوسائط للتشويش (يتطلب إعادة تحميل الصفحة):",
		blurImages: "الصور",
		blurVideos: "مقاطع الفيديو",
		facesToBlur: "الوجوه للتشويش (يتطلب إعادة تحميل الصفحة):",
		blurMale: "ذكر",
		blurFemale: "أنثى",
		unblurOnHover: "رفع التشويش عند التحويم (يتطلب إعادة تحميل الصفحة):",
		unblurImages: "الصور",
		unblurVideos: "مقاطع الفيديو"
	}
};

// Default language set to English
var defaultLanguage = 'en';

function changeLanguage(lang) {
	console.log('Changing language to:', lang);
	
	const ids = Object.keys(language[lang]);
	ids.forEach(id => {
		const element = document.getElementById(id);
		if (element) {
			element.innerText = language[lang][id];
		}
	});	
}


