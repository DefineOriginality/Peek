async function fetchInfo(path) {
  const response = await fetch(path, {headers: {"X-Session-ID": "peekextension"}});

  if (!response.ok) {
    throw new Error(`TETR.IO API error: ${response.status}`);
  }
  return response.json();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type == "get-league-summary") {
    fetchInfo(`https://ch.tetr.io/api/users/${message.user}/summaries/league`)
      .then((summary) => sendResponse({ ok: true, summary }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  } else if (message.type == "get-tl-opps") {
    fetchInfo(`https://ch.tetr.io/api/users/${message.user}/records/league/recent`)
      .then((summary) => sendResponse({ ok: true, summary }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  } else {
    return;
  }
});
