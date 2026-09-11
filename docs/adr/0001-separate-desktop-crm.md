# Keep the desktop CRM in the web repository

Keep the native consumer app in the Expo Caffriend repository and build the desktop CRM in the existing Next.js web repository under `/app`, preserving the public landing page at `/`. This respects the user's explicit desktop/native ownership boundary while allowing the marketing site and authenticated web experience to share their existing domain and deployment; backend identity and business services remain in their separate repository.
