console.log("Service worker is active - should enable PWA functionality");

self.addEventListener("fetch", function (event) {
	event.respondWith(
		fetch(event.request)
			.catch(function() {
				return caches.match(event.request)
			})
			.then(function (response) {				
				return response;
			})
	)
})
