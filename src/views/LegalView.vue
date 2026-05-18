<template>
  <main class="page">
    <div class="legal-container">
      <section class="legal-section card-surface mt-2">
        <h1>Privacy Policy</h1>
        <p class="text-muted">Effective Date: 18th May 2026</p>

        <h2>Introduction</h2>
        <p>Welcome to Vocab-Kids ("we," "our," or "us"). We are committed to protecting the privacy of our users, especially children. Vocab-Kids is a Single Page Application (SPA) designed to help children learn vocabulary through flashcards.</p>
        <p>Because our app is intended for children, we take privacy very seriously. This Privacy Policy explains how we handle information in our application.</p>

        <h2>Information We Collect and How We Use It</h2>
        <p>Vocab-Kids is designed to run offline and prioritizes local data storage.</p>
        <p><strong>Local Storage:</strong> By default, all gameplay, custom flashcards, and learning progress are stored locally on your device. We do not collect or store this data on our own servers.</p>
        <p><strong>Google Drive Integration:</strong> If you choose to use the backup/sync feature, the app will request access to your Google Drive.</p>
        <ul>
          <li><strong>Scope of Access:</strong> We only request access to create and modify specific files created by this app (using the limited drive.file scope). We cannot view, access, or alter any other files in your Google Drive.</li>
          <li><strong>Purpose:</strong> This access is used strictly to sync your child's flashcards and learning progress across devices.</li>
        </ul>

        <h2>Data Retention and Deletion</h2>
        <p><strong>Your Control:</strong> Since we do not host your data on our own servers, we cannot delete it for you. You can delete your data at any time by clearing your browser's local storage or deleting the "Vocab-Kids" sync file directly from your Google Drive.</p>
        <p><strong>Revoking Access:</strong> You can revoke Vocab-Kids' access to your Google Account at any time through your Google Account Security settings.</p>

        <h2>Children's Privacy</h2>
        <p>Vocab-Kids does not knowingly collect, store, or share any personally identifiable information from children. The Google Drive sync function requires a Google Account and should be set up and managed by a parent or legal guardian.</p>

        <h2>Third-Party Services</h2>
        <p>We do not sell, trade, or rent user data to third parties. We use Google Drive API services solely for storage functionality. Your use of Google Drive is subject to the Google Privacy Policy.</p>

        <h2>Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us at:</p>
        <p>z.wang@ymail.com</p>
      </section>

      <section class="legal-section card-surface mt-3">
        <h1>Terms of Service</h1>
        <p class="text-muted">Effective Date: 18th May 2026</p>

        <h2>1. Acceptance of Terms</h2>
        <p>By using Vocab-Kids (the "Application"), you agree to be bound by these Terms of Service. If you are a parent or guardian allowing a child to use this Application, you agree to these terms on their behalf.</p>

        <h2>2. Description of Service</h2>
        <p>Vocab-Kids is a web-based flashcard application designed for children's learning. The application includes features allowing users to save data locally and optionally synchronize that data using their personal Google Drive accounts.</p>

        <h2>3. Use of Google Drive Sync</h2>
        <ul>
          <li><strong>Parental Consent:</strong> The Google Drive sync feature must be configured and authorized by a parent or legal guardian.</li>
          <li><strong>Account Responsibility:</strong> You are entirely responsible for maintaining the security and privacy of your own Google Account. Vocab-Kids is not responsible for any data loss or security breaches originating from your Google Account.</li>
          <li><strong>Data Availability:</strong> Because data is stored locally or on your personal Google Drive, we cannot recover lost flashcards or progress if your browser data is cleared or if files are deleted from your Google Drive.</li>
        </ul>

        <h2>4. Intellectual Property</h2>
        <p>The design, code, graphics, and default flashcards within Vocab-Kids are the property of the app creator. You are granted a limited, non-exclusive, non-transferable license to use the application for personal, non-commercial educational purposes. Any custom flashcards or content you create remain yours.</p>

        <h2>5. Disclaimer of Warranties</h2>
        <p>Vocab-Kids is provided "as is" and "as available," without warranties of any kind, either express or implied. We do not guarantee that the application will always be error-free, uninterrupted, or that syncing will never experience technical disruptions.</p>

        <h2>6. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, the creators of Vocab-Kids shall not be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use the application.</p>

        <h2>7. Changes to Terms</h2>
        <p>We reserve the right to modify these terms at any time. We will notify users of any significant changes by updating the "Effective Date" at the top of this document.</p>

        <h2>8. Contact Information</h2>
        <p>For any questions regarding these Terms, please contact:</p>
        <p>z.wang@ymail.com</p>
      </section>

      <div class="mt-3 flex-center">
        <button class="btn btn-primary" @click="$router.push('/settings')">Back to Settings</button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.legal-container {
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 3rem;
}
.legal-section {
  padding: 2rem;
}
h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: var(--color-primary);
}
h2 {
  font-size: 1.25rem;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  font-weight: 800;
}
p, li {
  line-height: 1.6;
  margin-bottom: 1rem;
}
ul {
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}
.flex-center {
  display: flex;
  justify-content: center;
}
</style>
