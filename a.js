// Wait for KnotapiJS to be available
function initializeKnot() {
    console.log("Initializing KnotapiJS");
    if (window.KnotapiJS && window.KnotapiJS.default) {
        console.log("✅ KnotapiJS loaded successfully");
        
        const KnotapiJS = window.KnotapiJS.default;
        const knotapi = new KnotapiJS();
        console.log("KnotapiJS instance created");
        // Invoke the open method with parameters
        knotapi.open({
            sessionId: "915efe72-5136-4652-z91q-d9d48003c102",
            clientId: "dda0778d-9486-47f8-bd80-6f2512f9bcdb",
            environment: "development",  // or "production"
            product: "transaction_link",  // or "transaction_link"
            merchantIds: [44], // Recommend 0 or 1 merchant IDs
            entryPoint: "onboarding", // Defined by you
        });
        
        console.log("🚀 Knot API initialized");
    } else {
        console.log("⏳ Waiting for KnotapiJS to load...");
        setTimeout(initializeKnot, 100);
    }
}

// Start initialization
initializeKnot();