// Use event delegation to handle changes in the select element (language selecting dropdown at header)
document.getElementById('language').addEventListener('change', function() {
	changeLanguage(this.value);
  });

// Language dictionary containing translations for English and Arabic
var language = {
	eng: {
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
var defaultLanguage = 'eng';
document.getElementById('title').textContent = language[defaultLanguage].title;
document.getElementById('settings').textContent = language[defaultLanguage].settings;
document.getElementById('blurryStart').textContent = language[defaultLanguage].blurryStart;
document.getElementById('blurAmount').textContent = language[defaultLanguage].blurAmount;
document.getElementById('strictness').textContent = language[defaultLanguage].strictness;
document.getElementById('grayscale').textContent = language[defaultLanguage].grayscale;
document.getElementById('mediaToBlur').textContent = language[defaultLanguage].mediaToBlur;
document.getElementById('blurImages').textContent = language[defaultLanguage].blurImages;
document.getElementById('blurVideos').textContent = language[defaultLanguage].blurVideos;
document.getElementById('facesToBlur').textContent = language[defaultLanguage].facesToBlur;
document.getElementById('blurMale').textContent = language[defaultLanguage].blurMale;
document.getElementById('blurFemale').textContent = language[defaultLanguage].blurFemale;
document.getElementById('unblurOnHover').textContent = language[defaultLanguage].unblurOnHover;
document.getElementById('unblurImages').textContent = language[defaultLanguage].unblurImages;
document.getElementById('unblurVideos').textContent = language[defaultLanguage].unblurVideos;

function changeLanguage(lang) {
	console.log('Changing language to:', lang);
	  // Loop through each element with a language key and update its text content
	document.getElementById('title').textContent = language[lang].title;
	document.getElementById('settings').textContent = language[lang].settings;
	document.getElementById('blurryStart').textContent = language[lang].blurryStart;
	document.getElementById('blurAmount').textContent = language[lang].blurAmount;
	document.getElementById('strictness').textContent = language[lang].strictness;
	document.getElementById('grayscale').textContent = language[lang].grayscale;
	document.getElementById('mediaToBlur').textContent = language[lang].mediaToBlur;
	document.getElementById('blurImages').textContent = language[lang].blurImages;
	document.getElementById('blurVideos').textContent = language[lang].blurVideos;
	document.getElementById('facesToBlur').textContent = language[lang].facesToBlur;
	document.getElementById('blurMale').textContent = language[lang].blurMale;
	document.getElementById('blurFemale').textContent = language[lang].blurFemale;
	document.getElementById('unblurOnHover').textContent = language[lang].unblurOnHover;
	document.getElementById('unblurImages').textContent = language[lang].unblurImages;
	document.getElementById('unblurVideos').textContent = language[lang].unblurVideos;
	// Update other elements similarly
}


