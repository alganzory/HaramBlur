// background.js


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	console.log ("changeInfo", changeInfo, "tab", tab)
  if (changeInfo.status === 'complete') {
	console.log("running face detection");
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['dist/content.js']
    });
  }
});
