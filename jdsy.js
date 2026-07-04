console.log("JD script loaded");

if ($request && $response) {
    console.log("MITM mode");
    var data = {
        url: $request.url,
        time: new Date().toLocaleTimeString()
    };
    $persistentStore.write(JSON.stringify(data), "jd_test");
    $notify("MITM OK", data.url, data.time);
    $done({});
} else {
    console.log("cron mode");
    var raw = $persistentStore.read("jd_test");
    if (raw) {
        $notify("Cron OK", "has cache", raw);
    } else {
        $notify("Cron OK", "no cache", "open app first");
    }
    $done({});
}
